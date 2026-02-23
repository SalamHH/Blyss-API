from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
from fastapi import HTTPException, status
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.api.client.resend import ResendError, send_otp_email
from app.config import get_settings
from app.database.models.auth import OtpCode, RefreshToken
from app.database.models.user import User


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _hash_otp(email: str, otp_code: str) -> str:
    settings = get_settings()
    payload = f"{_normalize_email(email)}:{otp_code}".encode("utf-8")
    key = settings.auth_otp_secret.encode("utf-8")
    return hmac.new(key, payload, hashlib.sha256).hexdigest()


def _make_access_token(user_id: int) -> str:
    settings = get_settings()
    now = _utcnow()
    exp = now + timedelta(minutes=settings.auth_access_token_ttl_minutes)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "jti": uuid4().hex,
    }
    return jwt.encode(payload, settings.auth_jwt_secret, algorithm=settings.auth_jwt_algorithm)


def _make_refresh_token(user_id: int) -> tuple[str, str, datetime]:
    settings = get_settings()
    now = _utcnow()
    exp = now + timedelta(days=settings.auth_refresh_token_ttl_days)
    jti = uuid4().hex
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "jti": jti,
    }
    token = jwt.encode(payload, settings.auth_jwt_secret, algorithm=settings.auth_jwt_algorithm)
    return token, jti, exp


def request_otp(db: Session, email: str) -> str | None:
    settings = get_settings()
    normalized_email = _normalize_email(email)
    otp_code = "".join(secrets.choice("0123456789") for _ in range(settings.auth_otp_length))
    otp_hash = _hash_otp(normalized_email, otp_code)

    entry = OtpCode(
        email=normalized_email,
        otp_hash=otp_hash,
        expires_at=_utcnow() + timedelta(minutes=settings.auth_otp_ttl_minutes),
    )
    db.add(entry)
    db.commit()

    if settings.resend_api_key and settings.email_from:
        try:
            send_otp_email(
                api_key=settings.resend_api_key,
                from_email=settings.email_from,
                to_email=normalized_email,
                otp_code=otp_code,
                otp_ttl_minutes=settings.auth_otp_ttl_minutes,
                base_url=settings.resend_api_base_url,
            )
        except ResendError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not send OTP email. Please try again.",
            ) from exc
    elif settings.environment == "production":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email delivery is not configured.",
        )

    if settings.environment != "production":
        return otp_code
    return None


def _find_valid_otp(db: Session, email: str, otp_code: str) -> OtpCode | None:
    normalized_email = _normalize_email(email)
    otp_hash = _hash_otp(normalized_email, otp_code)
    now = _utcnow()

    query: Select[tuple[OtpCode]] = (
        select(OtpCode)
        .where(OtpCode.email == normalized_email)
        .where(OtpCode.otp_hash == otp_hash)
        .where(OtpCode.consumed_at.is_(None))
        .where(OtpCode.expires_at > now)
        .order_by(OtpCode.created_at.desc())
        .limit(1)
    )
    return db.execute(query).scalar_one_or_none()


def _get_or_create_user(db: Session, email: str) -> User:
    normalized_email = _normalize_email(email)
    user = db.execute(select(User).where(User.email == normalized_email)).scalar_one_or_none()
    if user:
        return user

    user = User(email=normalized_email)
    db.add(user)
    db.flush()
    return user


def verify_otp_and_issue_tokens(
    db: Session,
    *,
    email: str,
    otp_code: str,
    user_agent: str | None,
    ip_address: str | None,
) -> dict[str, str | int]:
    otp_entry = _find_valid_otp(db, email, otp_code)
    if not otp_entry:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired OTP")

    otp_entry.consumed_at = _utcnow()
    user = _get_or_create_user(db, email)

    access_token = _make_access_token(user.id)
    refresh_token, refresh_jti, refresh_exp = _make_refresh_token(user.id)

    db.add(
        RefreshToken(
            user_id=user.id,
            token_jti=refresh_jti,
            user_agent=user_agent,
            ip_address=ip_address,
            expires_at=refresh_exp,
        )
    )
    db.commit()

    settings = get_settings()
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.auth_access_token_ttl_minutes * 60,
    }


def _decode_token(token: str, expected_type: str) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.auth_jwt_secret,
            algorithms=[settings.auth_jwt_algorithm],
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    if payload.get("type") != expected_type:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    return payload


def get_user_from_access_token(db: Session, token: str) -> User:
    payload = _decode_token(token, expected_type="access")
    user_id = int(payload["sub"])
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def refresh_tokens(
    db: Session,
    *,
    refresh_token: str,
    user_agent: str | None,
    ip_address: str | None,
) -> dict[str, str | int]:
    payload = _decode_token(refresh_token, expected_type="refresh")
    user_id = int(payload["sub"])
    jti = str(payload["jti"])

    token_row = db.execute(select(RefreshToken).where(RefreshToken.token_jti == jti)).scalar_one_or_none()
    if not token_row or token_row.is_revoked or token_row.expires_at <= _utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token is invalid")

    token_row.is_revoked = True
    token_row.revoked_at = _utcnow()

    access_token = _make_access_token(user_id)
    new_refresh_token, new_jti, new_exp = _make_refresh_token(user_id)

    db.add(
        RefreshToken(
            user_id=user_id,
            token_jti=new_jti,
            user_agent=user_agent,
            ip_address=ip_address,
            expires_at=new_exp,
        )
    )
    db.commit()

    settings = get_settings()
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "expires_in": settings.auth_access_token_ttl_minutes * 60,
    }


def revoke_refresh_token(db: Session, refresh_token: str) -> None:
    try:
        payload = _decode_token(refresh_token, expected_type="refresh")
    except HTTPException:
        return

    jti = str(payload["jti"])
    token_row = db.execute(select(RefreshToken).where(RefreshToken.token_jti == jti)).scalar_one_or_none()
    if token_row and not token_row.is_revoked:
        token_row.is_revoked = True
        token_row.revoked_at = _utcnow()
        db.commit()
