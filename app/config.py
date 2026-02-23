from functools import lru_cache
import json
from typing import Any
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "local"
    app_name: str = "Blyss API"
    api_v1_prefix: str = "/api/v1"

    # Render provides DATABASE_URL for managed PostgreSQL.
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/blyss"
    sqlalchemy_echo: bool = False
    cors_allowed_origins: Annotated[list[str], NoDecode] = []
    cors_allow_credentials: bool = True
    cors_allow_methods: list[str] = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    cors_allow_headers: list[str] = ["*"]

    rate_limit_window_seconds: int = 60
    rate_limit_auth_requests_per_window: int = 30

    auth_jwt_secret: str = "replace-me-in-production"
    auth_jwt_algorithm: str = "HS256"
    auth_access_token_ttl_minutes: int = 30
    auth_refresh_token_ttl_days: int = 30
    auth_otp_secret: str = "replace-me-in-production"
    auth_otp_ttl_minutes: int = 10
    auth_otp_length: int = 6

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> list[str]:
        if value in (None, ""):
            return []

        if isinstance(value, str):
            raw = value.strip()
            if raw.startswith("["):
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
            return [item.strip() for item in raw.split(",") if item.strip()]

        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]

        raise ValueError("Invalid CORS origin format")


@lru_cache
def get_settings() -> Settings:
    return Settings()
