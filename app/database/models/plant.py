from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Plant(Base):
    __tablename__ = "plants"
    __table_args__ = (Index("ix_plants_owner_id", "owner_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    species: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    owner: Mapped["User"] = relationship("User", back_populates="plants")
    photos: Mapped[list["PlantPhoto"]] = relationship(
        "PlantPhoto", back_populates="plant", cascade="all, delete-orphan"
    )


class PlantPhoto(Base):
    __tablename__ = "plant_photos"
    __table_args__ = (Index("ix_plant_photos_plant_id", "plant_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    caption: Mapped[str | None] = mapped_column(Text)
    taken_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    ai_health_score: Mapped[int | None] = mapped_column(Integer)
    ai_issues: Mapped[str | None] = mapped_column(Text)
    ai_recommendations: Mapped[str | None] = mapped_column(Text)
    model_version: Mapped[str | None] = mapped_column(String(40))

    plant: Mapped[Plant] = relationship("Plant", back_populates="photos")
