"""Application configuration.

All settings are environment driven with demo-friendly defaults so the
application runs immediately after `python -m app.seed`.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = DATA_DIR / "models"


class Settings(BaseSettings):
    """Runtime settings loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "LOGISENSE AI"
    app_version: str = "1.0.0"
    api_prefix: str = "/api"

    # PostgreSQL is the reference database. When the driver/host is not
    # reachable we transparently fall back to a local SQLite file so the
    # demo remains runnable without any external service.
    database_url: str = "postgresql://postgres:postgres@localhost:5432/logisense"
    sqlite_fallback: bool = True
    sqlite_path: str = str(DATA_DIR / "logisense.db")

    demo_mode: bool = True
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Optional external weather provider. The demo never requires it.
    weather_api_key: str | None = None
    weather_api_url: str = "https://api.open-meteo.com/v1/forecast"

    # Deterministic synthetic data generation.
    random_seed: int = 42

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_sqlite_fallback(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
