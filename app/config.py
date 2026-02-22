from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "local"
    app_name: str = "Blyss API"
    api_v1_prefix: str = "/api/v1"

    # Render provides DATABASE_URL for managed PostgreSQL.
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/blyss"
    sqlalchemy_echo: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
