import logging

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.api.service import auth_service
from app.database.session import get_db

router = APIRouter()
logger = logging.getLogger(__name__)


class RequestOtpIn(BaseModel):
    email: EmailStr


class RequestOtpOut(BaseModel):
    status: str
    message: str
    debug_otp: str | None = None


class VerifyOtpIn(BaseModel):
    email: EmailStr
    otp: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int


class RefreshIn(BaseModel):
    refresh_token: str


@router.post("/auth/request-otp", response_model=RequestOtpOut, status_code=status.HTTP_202_ACCEPTED)
def request_otp(payload: RequestOtpIn, db: Session = Depends(get_db)) -> RequestOtpOut:
    logger.info("auth.request_otp email=%s", payload.email)
    debug_otp = auth_service.request_otp(db, str(payload.email))
    return RequestOtpOut(
        status="accepted",
        message="If the email exists, an OTP will be sent.",
        debug_otp=debug_otp,
    )


@router.post("/auth/verify-otp", response_model=TokenOut)
def verify_otp(payload: VerifyOtpIn, request: Request, db: Session = Depends(get_db)) -> TokenOut:
    data = auth_service.verify_otp_and_issue_tokens(
        db,
        email=str(payload.email),
        otp_code=payload.otp,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    logger.info("auth.verify_otp success email=%s ip=%s", payload.email, request.client.host if request.client else None)
    return TokenOut(**data)


@router.post("/auth/refresh", response_model=TokenOut)
def refresh(payload: RefreshIn, request: Request, db: Session = Depends(get_db)) -> TokenOut:
    data = auth_service.refresh_tokens(
        db,
        refresh_token=payload.refresh_token,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    logger.info("auth.refresh success ip=%s", request.client.host if request.client else None)
    return TokenOut(**data)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: RefreshIn, db: Session = Depends(get_db)) -> None:
    auth_service.revoke_refresh_token(db, payload.refresh_token)
    logger.info("auth.logout")
    return None
