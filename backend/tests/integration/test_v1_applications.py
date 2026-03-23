from __future__ import annotations


def _build_payload() -> dict[str, object]:
    return {
        "order_amount_inr": 54000,
        "tenure_months": 6,
        "bank": "HDFC Bank",
        "monthly_income_inr": 92000,
        "card_type": "credit",
        "card_last_four": "1234",
        "metadata": {"channel": "checkout"},
    }


def test_create_application_and_idempotency(client_and_app):
    client, _ = client_and_app

    response = client.post(
        "/v1/applications",
        json=_build_payload(),
        headers={"Idempotency-Key": "idem-123"},
    )
    assert response.status_code == 200
    created = response.json()

    assert created["application_uuid"]
    assert created["auto_decision"] in {"Approve", "Decline"}
    assert created["final_decision"] == created["auto_decision"]
    assert created["decision_source"] == "auto"

    retry = client.post(
        "/v1/applications",
        json=_build_payload(),
        headers={"Idempotency-Key": "idem-123"},
    )
    assert retry.status_code == 200
    assert retry.json()["application_uuid"] == created["application_uuid"]

    listing = client.get("/v1/admin/applications")
    assert listing.status_code == 200
    list_data = listing.json()
    assert list_data["total"] == 1
    assert list_data["items"][0]["application_uuid"] == created["application_uuid"]


def test_admin_override_updates_final_decision(client_and_app):
    client, _ = client_and_app

    created = client.post("/v1/applications", json=_build_payload()).json()
    app_uuid = created["application_uuid"]
    original_decision = created["final_decision"]
    override_decision = "Decline" if original_decision == "Approve" else "Approve"

    override = client.post(
        f"/v1/admin/applications/{app_uuid}/override",
        json={"decision": override_decision, "reason": "Manual underwriting review"},
    )
    assert override.status_code == 200
    override_data = override.json()
    assert override_data["final_decision"] == override_decision
    assert override_data["decision_source"] == "manual_override"
    assert override_data["override_reason"] == "Manual underwriting review"

    details = client.get(f"/v1/admin/applications/{app_uuid}")
    assert details.status_code == 200
    detail_data = details.json()
    assert detail_data["final_decision"] == override_decision
    assert detail_data["decision_source"] == "manual_override"

