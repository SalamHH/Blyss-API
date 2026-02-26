import enum
from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class FlowerStatus(str, enum.Enum):
    growing = "growing"
    ready = "ready"
    sent = "sent"


class DropType(str, enum.Enum):
    text = "text"
    voice = "voice"
    photo = "photo"
    video = "video"
    mood = "mood"


class DeliveryMode(str, enum.Enum):
    instant = "instant"
    scheduled = "scheduled"


class Flower(Base):
    __tablename__ = "flowers"
    __table_args__ = (Index("ix_flowers_owner_id_status", "owner_id", "status"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    flower_type: Mapped[str] = mapped_column(String(32), nullable=False, server_default=text("'rose'"))
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default=text("'growing'"))
    stage: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    water_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    streak_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    last_watered_on: Mapped[date | None] = mapped_column(Date())
    ready_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped["User"] = relationship("User", back_populates="flowers")
    drops: Mapped[list["FlowerDrop"]] = relationship(
        "FlowerDrop", back_populates="flower", cascade="all, delete-orphan"
    )
    delivery: Mapped["FlowerDelivery | None"] = relationship(
        "FlowerDelivery", back_populates="flower", cascade="all, delete-orphan", uselist=False
    )


class FlowerDrop(Base):
    __tablename__ = "flower_drops"
    __table_args__ = (
        UniqueConstraint("flower_id", "day_number", name="uq_flower_drops_flower_day_number"),
        Index("ix_flower_drops_flower_id_created_at", "flower_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    flower_id: Mapped[int] = mapped_column(ForeignKey("flowers.id", ondelete="CASCADE"), nullable=False)
    day_number: Mapped[int] = mapped_column(Integer, nullable=False)
    drop_type: Mapped[str] = mapped_column(String(16), nullable=False)
    text_content: Mapped[str | None] = mapped_column(Text)
    media_url: Mapped[str | None] = mapped_column(Text)
    mime_type: Mapped[str | None] = mapped_column(String(100))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    prompt_key: Mapped[str | None] = mapped_column(String(64))
    mood_tags: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    flower: Mapped[Flower] = relationship("Flower", back_populates="drops")


class FlowerDelivery(Base):
    __tablename__ = "flower_deliveries"
    __table_args__ = (
        UniqueConstraint("flower_id", name="uq_flower_deliveries_flower_id"),
        Index("ix_flower_deliveries_share_token", "share_token"),
        Index("ix_flower_deliveries_scheduled_for", "scheduled_for"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    flower_id: Mapped[int] = mapped_column(ForeignKey("flowers.id", ondelete="CASCADE"), nullable=False)
    share_token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    recipient_name: Mapped[str | None] = mapped_column(String(80))
    recipient_contact: Mapped[str | None] = mapped_column(String(255))
    delivery_mode: Mapped[str] = mapped_column(String(16), nullable=False, server_default=text("'instant'"))
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    flower: Mapped[Flower] = relationship("Flower", back_populates="delivery")
    reactions: Mapped[list["DeliveryReaction"]] = relationship(
        "DeliveryReaction", back_populates="delivery", cascade="all, delete-orphan"
    )


class DeliveryReaction(Base):
    __tablename__ = "delivery_reactions"
    __table_args__ = (
        Index("ix_delivery_reactions_delivery_id", "delivery_id"),
        UniqueConstraint("delivery_id", "emoji", name="uq_delivery_reactions_delivery_emoji"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    delivery_id: Mapped[int] = mapped_column(
        ForeignKey("flower_deliveries.id", ondelete="CASCADE"), nullable=False
    )
    emoji: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    delivery: Mapped[FlowerDelivery] = relationship("FlowerDelivery", back_populates="reactions")
