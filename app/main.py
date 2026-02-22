from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import get_settings
from app.security.rate_limit import RateLimitMiddleware

settings = get_settings()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)
app.add_middleware(
    RateLimitMiddleware,
    auth_paths=(f"{settings.api_v1_prefix}/auth", f"{settings.api_v1_prefix}/upload"),
    auth_limit=settings.rate_limit_auth_requests_per_window,
    window_seconds=settings.rate_limit_window_seconds,
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/", tags=["meta"])
def root() -> dict[str, str]:
    return {"service": settings.app_name, "status": "ok"}
