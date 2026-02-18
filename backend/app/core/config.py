from __future__ import annotations

import os
from dataclasses import dataclass

DEFAULT_DATABASE_URL = "sqlite:///./fairlens.db"
DEFAULT_ML_SERVICE_URL = "http://localhost:9000"
DEFAULT_ML_TIMEOUT = 3.5
DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
]


@dataclass(frozen=True)
class Settings:
    database_url: str
    cors_origins: list[str]
    ml_service_url: str
    ml_service_timeout: float
    model_path: str | None
    model_metadata_path: str | None


def _parse_cors_origins(raw: str | None) -> list[str]:
    if not raw:
        return list(DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def get_settings() -> Settings:
    return Settings(
        database_url=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL),
        cors_origins=_parse_cors_origins(os.getenv("CORS_ORIGINS")),
        ml_service_url=os.getenv("ML_SERVICE_URL", DEFAULT_ML_SERVICE_URL).rstrip("/"),
        ml_service_timeout=float(os.getenv("ML_SERVICE_TIMEOUT", str(DEFAULT_ML_TIMEOUT))),
        model_path=os.getenv("MODEL_PATH"),
        model_metadata_path=os.getenv("MODEL_METADATA_PATH"),
    )
