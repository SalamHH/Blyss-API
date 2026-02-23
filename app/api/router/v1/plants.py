from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models.plant import Plant
from app.database.models.user import User
from app.database.session import get_db

router = APIRouter()


def require_actor_user_id(x_user_id: Annotated[int | None, Header(alias="X-User-Id")] = None) -> int:
    if x_user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-User-Id header")
    if x_user_id <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="X-User-Id must be a positive integer")
    return x_user_id


def _ensure_user_exists(db: Session, user_id: int) -> None:
    user = db.get(User, user_id)
    if user:
        return
    db.add(
        User(
            id=user_id,
            handle=f"demo-{user_id}",
            display_name=f"Demo User {user_id}",
            email=f"demo-{user_id}@local.invalid",
        )
    )
    db.flush()


def _get_owned_plant_or_404(db: Session, user_id: int, plant_id: int) -> Plant:
    plant = db.execute(
        select(Plant).where(Plant.id == plant_id).where(Plant.owner_id == user_id)
    ).scalar_one_or_none()
    if not plant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")
    return plant


class PlantCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    species: str | None = Field(default=None, max_length=120)


class PlantUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    species: str | None = Field(default=None, max_length=120)


class PlantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    name: str
    species: str | None
    created_at: datetime


@router.post("/plants", response_model=PlantOut, status_code=status.HTTP_201_CREATED)
def create_plant(
    payload: PlantCreateIn,
    db: Session = Depends(get_db),
    user_id: int = Depends(require_actor_user_id),
) -> PlantOut:
    _ensure_user_exists(db, user_id)
    plant = Plant(owner_id=user_id, name=payload.name.strip(), species=payload.species)
    db.add(plant)
    db.commit()
    db.refresh(plant)
    return PlantOut.model_validate(plant)


@router.get("/plants", response_model=list[PlantOut])
def list_plants(
    db: Session = Depends(get_db),
    user_id: int = Depends(require_actor_user_id),
) -> list[PlantOut]:
    plants = db.execute(
        select(Plant).where(Plant.owner_id == user_id).order_by(Plant.created_at.desc(), Plant.id.desc())
    ).scalars()
    return [PlantOut.model_validate(plant) for plant in plants]


@router.get("/plants/{plant_id}", response_model=PlantOut)
def get_plant(
    plant_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(require_actor_user_id),
) -> PlantOut:
    plant = _get_owned_plant_or_404(db, user_id, plant_id)
    return PlantOut.model_validate(plant)


@router.patch("/plants/{plant_id}", response_model=PlantOut)
def update_plant(
    plant_id: int,
    payload: PlantUpdateIn,
    db: Session = Depends(get_db),
    user_id: int = Depends(require_actor_user_id),
) -> PlantOut:
    patch = payload.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided for update")

    plant = _get_owned_plant_or_404(db, user_id, plant_id)
    if "name" in patch and patch["name"] is not None:
        plant.name = patch["name"].strip()
    if "species" in patch:
        plant.species = patch["species"]

    db.commit()
    db.refresh(plant)
    return PlantOut.model_validate(plant)


@router.delete("/plants/{plant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plant(
    plant_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(require_actor_user_id),
) -> Response:
    plant = _get_owned_plant_or_404(db, user_id, plant_id)
    db.delete(plant)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
