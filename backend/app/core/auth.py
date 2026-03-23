from __future__ import annotations

import time
from dataclasses import dataclass
from threading import Lock
from typing import Any

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from .config import Settings, get_settings

bearer_scheme = HTTPBearer(auto_error=False)

_jwks_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_jwks_cache_lock = Lock()


@dataclass(frozen=True)
class AuthUser:
    subject: str | None
    email: str | None
    roles: tuple[str, ...]
    claims: dict[str, Any]
    is_authenticated: bool

    @classmethod
    def anonymous(cls) -> "AuthUser":
        return cls(
            subject=None,
            email=None,
            roles=(),
            claims={},
            is_authenticated=False,
        )


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _normalize_issuer(issuer: str) -> str:
    return issuer.rstrip("/")


def _extract_roles_from_claims(claims: dict[str, Any], role_claim: str) -> tuple[str, ...]:
    role_sources: list[Any] = [
        claims.get(role_claim),
        claims.get("roles"),
        claims.get("permissions"),
    ]

    app_metadata = claims.get("app_metadata")
    if isinstance(app_metadata, dict):
        role_sources.append(app_metadata.get("roles"))

    roles: list[str] = []
    for source in role_sources:
        if isinstance(source, str):
            if source and source not in roles:
                roles.append(source)
            continue
        if isinstance(source, list):
            for value in source:
                role = str(value).strip()
                if role and role not in roles:
                    roles.append(role)
    return tuple(roles)


def _validate_issuer(claims: dict[str, Any], expected_issuer: str) -> None:
    actual = str(claims.get("iss", "")).strip()
    if _normalize_issuer(actual) != _normalize_issuer(expected_issuer):
        raise _unauthorized("Token issuer mismatch")


def _fetch_jwks(settings: Settings) -> dict[str, Any]:
    if not settings.auth_jwks_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Auth is enabled but AUTH_JWKS_URL is not configured",
        )

    now = time.time()
    with _jwks_cache_lock:
        cached = _jwks_cache.get(settings.auth_jwks_url)
        if cached and cached[0] > now:
            return cached[1]

    try:
        response = httpx.get(settings.auth_jwks_url, timeout=settings.auth_http_timeout)
        response.raise_for_status()
        payload = response.json()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to fetch auth signing keys",
        ) from exc

    if not isinstance(payload, dict) or not isinstance(payload.get("keys"), list):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth signing key payload is invalid",
        )

    expires_at = now + max(5, settings.auth_jwks_cache_ttl_seconds)
    with _jwks_cache_lock:
        _jwks_cache[settings.auth_jwks_url] = (expires_at, payload)
    return payload


def _find_signing_key(jwks: dict[str, Any], kid: str) -> dict[str, Any] | None:
    for key in jwks.get("keys", []):
        if not isinstance(key, dict):
            continue
        if key.get("kid") == kid:
            return key
    return None


def _decode_with_shared_secret(token: str, settings: Settings) -> dict[str, Any]:
    try:
        claims = jwt.decode(
            token,
            settings.auth_shared_secret,
            algorithms=settings.auth_jwt_algorithms,
            audience=settings.auth_audience,
        )
    except JWTError as exc:
        raise _unauthorized("Invalid access token") from exc

    if settings.auth_issuer_base_url:
        _validate_issuer(claims, settings.auth_issuer_base_url)
    return claims


def _decode_with_jwks(token: str, settings: Settings) -> dict[str, Any]:
    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise _unauthorized("Invalid access token header") from exc

    kid = str(unverified_header.get("kid", "")).strip()
    if not kid:
        raise _unauthorized("Access token missing key id")

    jwks = _fetch_jwks(settings)
    signing_key = _find_signing_key(jwks, kid)
    if signing_key is None:
        raise _unauthorized("Signing key not found")

    try:
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=settings.auth_jwt_algorithms,
            audience=settings.auth_audience,
        )
    except JWTError as exc:
        raise _unauthorized("Invalid access token") from exc

    if settings.auth_issuer_base_url:
        _validate_issuer(claims, settings.auth_issuer_base_url)
    return claims


def _decode_token(token: str, settings: Settings) -> dict[str, Any]:
    if settings.auth_shared_secret:
        return _decode_with_shared_secret(token, settings)
    return _decode_with_jwks(token, settings)


def _has_auth_configuration(settings: Settings) -> bool:
    return bool(settings.auth_issuer_base_url and settings.auth_audience)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> AuthUser:
    auth_configured = _has_auth_configuration(settings)
    if settings.auth_required and not auth_configured:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Auth is required but AUTH_ISSUER_BASE_URL or AUTH_AUDIENCE is missing",
        )

    if credentials is None:
        if settings.auth_required:
            raise _unauthorized("Missing bearer token")
        return AuthUser.anonymous()

    if not auth_configured:
        if settings.auth_required:
            raise _unauthorized("Auth configuration missing")
        return AuthUser.anonymous()

    claims = _decode_token(credentials.credentials, settings)
    subject = str(claims.get("sub", "")).strip()
    if not subject:
        raise _unauthorized("Access token missing subject")

    roles = _extract_roles_from_claims(claims, settings.auth_role_claim)
    email = claims.get("email")
    return AuthUser(
        subject=subject,
        email=str(email).strip() if isinstance(email, str) and email.strip() else None,
        roles=roles,
        claims=claims,
        is_authenticated=True,
    )


def require_authenticated_user(
    user: AuthUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> AuthUser:
    if user.is_authenticated or not settings.auth_required:
        return user
    raise _unauthorized("Authentication required")


def require_admin_user(
    user: AuthUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> AuthUser:
    if not settings.auth_required:
        return user

    if not user.is_authenticated:
        raise _unauthorized("Authentication required")

    role_set = set(user.roles)
    allowed = set(settings.auth_admin_roles)
    if role_set.intersection(allowed):
        return user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Admin role required",
    )

