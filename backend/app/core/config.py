from __future__ import annotations

import os
from dataclasses import dataclass

DEFAULT_DATABASE_URL = "sqlite:///./fairlens.db"
DEFAULT_ML_SERVICE_URL = "http://localhost:9000"
DEFAULT_ML_TIMEOUT = 3.5
DEFAULT_AUTH_HTTP_TIMEOUT = 5.0
DEFAULT_AUTH_ROLE_CLAIM = "https://fairlens.ai/roles"
DEFAULT_AUTH_ADMIN_ROLES = ["admin"]
DEFAULT_AUTH_JWT_ALGORITHMS = ["RS256"]
DEFAULT_AUTH_JWKS_CACHE_TTL_SECONDS = 600
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
    auth_issuer_base_url: str | None
    auth_audience: str | None
    auth_jwks_url: str | None
    auth_required: bool
    auth_role_claim: str
    auth_admin_roles: list[str]
    auth_jwt_algorithms: list[str]
    auth_shared_secret: str | None
    auth_http_timeout: float
    auth_jwks_cache_ttl_seconds: int
    supabase_url: str | None
    supabase_anon_key: str | None
    supabase_service_role_key: str | None


def _parse_cors_origins(raw: str | None) -> list[str]:
    if not raw:
        return list(DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _parse_csv(raw: str | None, default: list[str]) -> list[str]:
    if not raw:
        return list(default)
    values = [value.strip() for value in raw.split(",") if value.strip()]
    return values or list(default)


def _parse_bool(raw: str | None, *, default: bool) -> bool:
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _read_first(*keys: str) -> str | None:
    for key in keys:
        value = os.getenv(key)
        if value and value.strip():
            return value.strip()
    return None


def get_settings() -> Settings:
    auth_issuer_base_url = _read_first("AUTH_ISSUER_BASE_URL", "AUTH0_ISSUER_BASE_URL")
    auth_audience = _read_first("AUTH_AUDIENCE", "AUTH0_AUDIENCE")

    default_auth_required = bool(auth_issuer_base_url and auth_audience)
    auth_required = _parse_bool(os.getenv("AUTH_REQUIRED"), default=default_auth_required)

    auth_jwks_url = _read_first("AUTH_JWKS_URL")
    if not auth_jwks_url and auth_issuer_base_url:
        auth_jwks_url = f"{auth_issuer_base_url.rstrip('/')}/.well-known/jwks.json"

    return Settings(
        database_url=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL),
        cors_origins=_parse_cors_origins(os.getenv("CORS_ORIGINS")),
        ml_service_url=os.getenv("ML_SERVICE_URL", DEFAULT_ML_SERVICE_URL).rstrip("/"),
        ml_service_timeout=float(os.getenv("ML_SERVICE_TIMEOUT", str(DEFAULT_ML_TIMEOUT))),
        model_path=os.getenv("MODEL_PATH"),
        model_metadata_path=os.getenv("MODEL_METADATA_PATH"),
        auth_issuer_base_url=auth_issuer_base_url,
        auth_audience=auth_audience,
        auth_jwks_url=auth_jwks_url,
        auth_required=auth_required,
        auth_role_claim=os.getenv("AUTH_ROLE_CLAIM", DEFAULT_AUTH_ROLE_CLAIM),
        auth_admin_roles=_parse_csv(os.getenv("AUTH_ADMIN_ROLES"), DEFAULT_AUTH_ADMIN_ROLES),
        auth_jwt_algorithms=_parse_csv(os.getenv("AUTH_JWT_ALGORITHMS"), DEFAULT_AUTH_JWT_ALGORITHMS),
        auth_shared_secret=_read_first("AUTH_SHARED_SECRET"),
        auth_http_timeout=float(os.getenv("AUTH_HTTP_TIMEOUT", str(DEFAULT_AUTH_HTTP_TIMEOUT))),
        auth_jwks_cache_ttl_seconds=int(
            os.getenv("AUTH_JWKS_CACHE_TTL_SECONDS", str(DEFAULT_AUTH_JWKS_CACHE_TTL_SECONDS))
        ),
        supabase_url=_read_first("SUPABASE_URL"),
        supabase_anon_key=_read_first("SUPABASE_ANON_KEY"),
        supabase_service_role_key=_read_first("SUPABASE_SERVICE_ROLE_KEY"),
    )
