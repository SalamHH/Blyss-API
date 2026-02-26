from __future__ import annotations

from datetime import UTC, datetime
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database.models.flower import (
    DeliveryMode,
    DropType,
    Flower,
    FlowerDelivery,
    FlowerDrop,
    FlowerStatus,
)
from app.database.models.user import User
from app.database.session import get_db
from app.security.auth import require_current_user

router = APIRouter()

READY_WATER_COUNT = 7


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _get_stage_for_water_count(water_count: int) -> int:
    if water_count >= READY_WATER_COUNT:
        return 2
    if water_count >= 3:
        return 1
    return 0


def _get_owned_flower_or_404(db: Session, user_id: int, flower_id: int) -> Flower:
    flower = db.execute(
        select(Flower)
        .where(Flower.id == flower_id)
        .where(Flower.owner_id == user_id)
        .options(selectinload(Flower.delivery))
    ).scalar_one_or_none()
    if not flower:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flower not found")
    return flower


class FlowerCreateIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    flower_type: str = Field(default="rose", min_length=1, max_length=32)


class FlowerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    title: str
    flower_type: str
    status: str
    stage: int
    water_count: int
    streak_count: int
    ready_at: datetime | None
    sent_at: datetime | None
    created_at: datetime


class FlowerWaterIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    drop_type: str = Field(default=DropType.text.value, min_length=1, max_length=16)
    media_url: str | None = Field(default=None, max_length=2000)
    mime_type: str | None = Field(default=None, max_length=100)
    duration_seconds: int | None = Field(default=None, ge=1, le=3600)
    prompt_key: str | None = Field(default=None, max_length=64)
    mood_tags: str | None = Field(default=None, max_length=120)


class FlowerWaterOut(BaseModel):
    flower: FlowerOut
    drop_id: int
    day_number: int


class FlowerSendIn(BaseModel):
    recipient_name: str | None = Field(default=None, max_length=80)
    recipient_contact: str | None = Field(default=None, max_length=255)
    delivery_mode: str = Field(default=DeliveryMode.instant.value, min_length=1, max_length=16)
    scheduled_for: datetime | None = None


class FlowerSendOut(BaseModel):
    flower_id: int
    share_token: str
    delivery_mode: str
    scheduled_for: datetime | None
    sent_at: datetime | None


class DropRevealOut(BaseModel):
    id: int
    day_number: int
    drop_type: str
    message: str | None
    media_url: str | None
    created_at: datetime


class FlowerOpenOut(BaseModel):
    flower_id: int
    title: str
    flower_type: str
    sender_name: str
    opened_at: datetime | None
    drops: list[DropRevealOut]


@router.post("/flowers", response_model=FlowerOut, status_code=status.HTTP_201_CREATED)
def create_flower(
    payload: FlowerCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> FlowerOut:
    flower = Flower(
        owner_id=current_user.id,
        title=payload.title.strip(),
        flower_type=payload.flower_type.strip().lower(),
    )
    db.add(flower)
    db.commit()
    db.refresh(flower)
    return FlowerOut.model_validate(flower)


@router.get("/flowers", response_model=list[FlowerOut])
def list_flowers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> list[FlowerOut]:
    flowers = db.execute(
        select(Flower).where(Flower.owner_id == current_user.id).order_by(Flower.created_at.desc(), Flower.id.desc())
    ).scalars()
    return [FlowerOut.model_validate(flower) for flower in flowers]


@router.post("/flowers/{flower_id}/water", response_model=FlowerWaterOut)
def water_flower(
    flower_id: int,
    payload: FlowerWaterIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> FlowerWaterOut:
    flower = _get_owned_flower_or_404(db, current_user.id, flower_id)

    if flower.status == FlowerStatus.sent.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Flower already sent")
    if flower.delivery:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Flower already has a delivery")

    now = _utcnow()
    today = now.date()
    if flower.last_watered_on == today:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Flower already watered today")

    day_number = flower.water_count + 1
    drop_type = payload.drop_type.strip().lower()
    if drop_type not in {item.value for item in DropType}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid drop type")

    drop = FlowerDrop(
        flower_id=flower.id,
        day_number=day_number,
        drop_type=drop_type,
        text_content=payload.message.strip(),
        media_url=payload.media_url,
        mime_type=payload.mime_type,
        duration_seconds=payload.duration_seconds,
        prompt_key=payload.prompt_key,
        mood_tags=payload.mood_tags,
    )
    db.add(drop)

    if flower.last_watered_on and (today - flower.last_watered_on).days == 1:
        flower.streak_count += 1
    else:
        flower.streak_count = 1
    flower.last_watered_on = today
    flower.water_count = day_number
    flower.stage = _get_stage_for_water_count(day_number)

    if day_number >= READY_WATER_COUNT and flower.status == FlowerStatus.growing.value:
        flower.status = FlowerStatus.ready.value
        if not flower.ready_at:
            flower.ready_at = now

    db.commit()
    db.refresh(flower)
    db.refresh(drop)

    return FlowerWaterOut(
        flower=FlowerOut.model_validate(flower),
        drop_id=drop.id,
        day_number=drop.day_number,
    )


@router.post("/flowers/{flower_id}/send", response_model=FlowerSendOut)
def send_flower(
    flower_id: int,
    payload: FlowerSendIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> FlowerSendOut:
    flower = _get_owned_flower_or_404(db, current_user.id, flower_id)

    if flower.delivery:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Flower already has a delivery")
    if flower.status != FlowerStatus.ready.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Flower is not ready to send")

    mode = payload.delivery_mode.strip().lower()
    if mode not in (DeliveryMode.instant.value, DeliveryMode.scheduled.value):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid delivery mode")

    now = _utcnow()
    scheduled_for = payload.scheduled_for
    if mode == DeliveryMode.scheduled.value:
        if not scheduled_for:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="scheduled_for is required for scheduled delivery"
            )
        scheduled_for = _to_utc(scheduled_for)
        if scheduled_for <= now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="scheduled_for must be in the future"
            )

    share_token = secrets.token_urlsafe(32)[:64]
    sent_at = now if mode == DeliveryMode.instant.value else None
    delivery = FlowerDelivery(
        flower_id=flower.id,
        share_token=share_token,
        recipient_name=payload.recipient_name,
        recipient_contact=payload.recipient_contact,
        delivery_mode=mode,
        scheduled_for=scheduled_for,
        sent_at=sent_at,
    )
    db.add(delivery)

    if mode == DeliveryMode.instant.value:
        flower.status = FlowerStatus.sent.value
        flower.sent_at = now

    db.commit()

    return FlowerSendOut(
        flower_id=flower.id,
        share_token=share_token,
        delivery_mode=mode,
        scheduled_for=scheduled_for,
        sent_at=sent_at,
    )


@router.get("/flowers/open/{share_token}", response_model=FlowerOpenOut)
def open_flower(share_token: str, db: Session = Depends(get_db)) -> FlowerOpenOut:
    delivery = db.execute(
        select(FlowerDelivery)
        .where(FlowerDelivery.share_token == share_token)
        .options(
            selectinload(FlowerDelivery.flower).selectinload(Flower.owner),
            selectinload(FlowerDelivery.flower).selectinload(Flower.drops),
        )
    ).scalar_one_or_none()
    if not delivery:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gift not found")

    now = _utcnow()
    if delivery.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Gift is no longer available")
    if delivery.expires_at is not None and _to_utc(delivery.expires_at) <= now:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Gift has expired")
    if delivery.scheduled_for is not None and _to_utc(delivery.scheduled_for) > now and delivery.sent_at is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Gift is not available yet")

    flower = delivery.flower
    if delivery.sent_at is None and delivery.scheduled_for is not None and _to_utc(delivery.scheduled_for) <= now:
        delivery.sent_at = now
        flower.status = FlowerStatus.sent.value
        flower.sent_at = now
    if delivery.opened_at is None:
        delivery.opened_at = now
    db.commit()

    sender_name = flower.owner.display_name or flower.owner.handle or flower.owner.email or "Someone"
    ordered_drops = sorted(flower.drops, key=lambda item: (item.day_number, item.created_at))
    return FlowerOpenOut(
        flower_id=flower.id,
        title=flower.title,
        flower_type=flower.flower_type,
        sender_name=sender_name,
        opened_at=delivery.opened_at,
        drops=[
            DropRevealOut(
                id=drop.id,
                day_number=drop.day_number,
                drop_type=drop.drop_type,
                message=drop.text_content,
                media_url=drop.media_url,
                created_at=drop.created_at,
            )
            for drop in ordered_drops
        ],
    )
