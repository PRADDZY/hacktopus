from __future__ import annotations

import time

from jose import jwt


def _configure_auth(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_REQUIRED", "true")
    monkeypatch.setenv("AUTH_ISSUER_BASE_URL", "https://auth.example.com/")
    monkeypatch.setenv("AUTH_AUDIENCE", "fairlens-api")
    monkeypatch.setenv("AUTH_JWT_ALGORITHMS", "HS256")
    monkeypatch.setenv("AUTH_SHARED_SECRET", "unit-test-secret")
    monkeypatch.setenv("AUTH_ROLE_CLAIM", "roles")
    monkeypatch.setenv("AUTH_ADMIN_ROLES", "admin")


def _build_token(*, roles: list[str]) -> str:
    now = int(time.time())
    payload = {
        "sub": "auth0|user-123",
        "email": "user@example.com",
        "roles": roles,
        "iss": "https://auth.example.com/",
        "aud": "fairlens-api",
        "iat": now,
        "exp": now + 1800,
    }
    return jwt.encode(payload, "unit-test-secret", algorithm="HS256")


def _build_predict_payload() -> dict[str, float | int]:
    return {
        "avg_monthly_inflow": 88000,
        "inflow_volatility": 0.21,
        "avg_monthly_outflow": 51000,
        "min_balance_30d": 15000,
        "neg_balance_days_30d": 2,
        "purchase_to_inflow_ratio": 0.33,
        "total_burden_ratio": 0.52,
        "buffer_ratio": 0.17,
        "stress_index": 0.43,
    }


def test_auth_me_is_anonymous_when_auth_not_required(client_and_app):
    client, _ = client_and_app
    response = client.get("/auth/me")
    assert response.status_code == 200
    assert response.json() == {
        "is_authenticated": False,
        "subject": None,
        "email": None,
        "roles": [],
    }


def test_predict_requires_token_when_auth_enabled(client_and_app, monkeypatch):
    client, _ = client_and_app
    _configure_auth(monkeypatch)

    response = client.post("/predict", json=_build_predict_payload())
    assert response.status_code == 401


def test_admin_routes_enforce_role(client_and_app, monkeypatch):
    client, _ = client_and_app
    _configure_auth(monkeypatch)

    user_token = _build_token(roles=["user"])
    user_response = client.get("/stats", headers={"Authorization": f"Bearer {user_token}"})
    assert user_response.status_code == 403

    admin_token = _build_token(roles=["admin"])
    admin_response = client.get("/stats", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_response.status_code == 200

