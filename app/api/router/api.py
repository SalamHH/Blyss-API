from fastapi import APIRouter

from app.api.router.v1.auth import router as auth_router
from app.api.router.v1.health import router as health_router
from app.api.router.v1.plants import router as plants_router
from app.api.router.v1.protected import router as protected_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(auth_router, tags=["auth"])
api_router.include_router(plants_router, tags=["plants"])
api_router.include_router(protected_router, tags=["protected"])
