from __future__ import annotations

import math
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

from sqlalchemy import String, cast, func, or_
from sqlalchemy.orm import Session

from ..models import Transaction
from ..schemas import CreateApplicationRequest, PredictRequest
from .audit_logs import create_audit_log

Decision = Literal["Approve", "Decline"]


def _derive_predict_payload(payload: CreateApplicationRequest) -> PredictRequest:
    monthly_emi = math.ceil(payload.order_amount_inr / payload.tenure_months)
    safe_inflow = max(payload.monthly_income_inr, 1)
    purchase_to_inflow_ratio = payload.order_amount_inr / safe_inflow
    avg_monthly_outflow = min(safe_inflow * 0.95, safe_inflow * 0.5 + monthly_emi)
    avg_balance_30d = max(0.0, safe_inflow - avg_monthly_outflow)
    min_balance_30d = max(0.0, safe_inflow - avg_monthly_outflow - monthly_emi * 0.2)
    inflow_volatility = min(1.0, max(0.01, 0.12 + purchase_to_inflow_ratio * 0.2))
    outflow_volatility = min(1.0, max(0.02, 0.16 + purchase_to_inflow_ratio * 0.15))
    neg_balance_days_30d = 4 if min_balance_30d == 0 else (2 if min_balance_30d < safe_inflow * 0.08 else 0)
    total_burden_ratio = min(1.0, (avg_monthly_outflow + monthly_emi) / safe_inflow)
    installment_to_inflow_ratio = min(1.0, monthly_emi / safe_inflow)
    buffer_ratio = max(0.0, min_balance_30d / safe_inflow)
    stress_index = min(1.0, inflow_volatility * 0.45 + total_burden_ratio * 0.55)
    essential_spend_ratio = min(1.0, max(0.1, avg_monthly_outflow / safe_inflow))
    active_loan_count = 2 if total_burden_ratio > 0.65 else 1

    return PredictRequest(
        segment="unknown",
        monthly_inflow=round(safe_inflow, 6),
        monthly_outflow=round(avg_monthly_outflow, 6),
        inflow_volatility_90d=round(inflow_volatility, 6),
        outflow_volatility_90d=round(outflow_volatility, 6),
        deposit_count_30d=4,
        days_since_last_income=7,
        avg_balance_30d=round(avg_balance_30d, 6),
        min_balance_30d=round(min_balance_30d, 6),
        negative_balance_days_30d=neg_balance_days_30d,
        essential_spend_ratio=round(essential_spend_ratio, 6),
        active_loan_count=active_loan_count,
        monthly_installment_burden=round(monthly_emi, 6),
        purchase_amount=round(payload.order_amount_inr, 6),
        tenure_weeks=payload.tenure_months * 4,
        purchase_to_inflow_ratio=round(purchase_to_inflow_ratio, 6),
        installment_to_inflow_ratio=round(installment_to_inflow_ratio, 6),
        total_burden_ratio=round(total_burden_ratio, 6),
        buffer_ratio=round(buffer_ratio, 6),
        stress_index=round(stress_index, 6),
    )


def _mask_card_last_four(value: str | None) -> str | None:
    if not value:
        return None
    return f"****{value[-4:]}"


def _resolve_decision(risk_probability: float, threshold: float) -> Decision:
    return "Decline" if risk_probability >= threshold else "Approve"


def _serialize_reasons(reasons: Any) -> list[dict[str, Any]]:
    if not isinstance(reasons, list):
        return []

    normalized: list[dict[str, Any]] = []
    for item in reasons:
        if isinstance(item, dict):
            normalized.append(
                {
                    "code": str(item.get("code", "")).strip(),
                    "feature": str(item.get("feature", "")).strip(),
                    "direction": "down"
                    if str(item.get("direction", "")).strip().lower() == "down"
                    else "up",
                    "impact": float(item.get("impact", 0.0) or 0.0),
                    "message": str(item.get("message", "")).strip(),
                }
            )
            continue
        if hasattr(item, "code") and hasattr(item, "feature"):
            normalized.append(
                {
                    "code": str(getattr(item, "code", "")).strip(),
                    "feature": str(getattr(item, "feature", "")).strip(),
                    "direction": "down"
                    if str(getattr(item, "direction", "")).strip().lower() == "down"
                    else "up",
                    "impact": float(getattr(item, "impact", 0.0) or 0.0),
                    "message": str(getattr(item, "message", "")).strip(),
                }
            )
    return [item for item in normalized if item["code"] and item["feature"]]


def _attach_score_context(
    transaction: Transaction,
    *,
    model_version: str,
    schema_version: str,
    calibration_bucket: str,
    reasons: list[dict[str, Any]],
) -> None:
    setattr(transaction, "_model_version", model_version)
    setattr(transaction, "_schema_version", schema_version)
    setattr(transaction, "_calibration_bucket", calibration_bucket)
    setattr(transaction, "_reasons", reasons)


def _get_idempotent_transaction(
    db: Session,
    *,
    user_sub: str | None,
    idempotency_key: str | None,
) -> Transaction | None:
    if not idempotency_key:
        return None

    query = db.query(Transaction).filter(Transaction.idempotency_key == idempotency_key)
    if user_sub:
        query = query.filter(Transaction.user_sub == user_sub)
    return query.order_by(Transaction.created_at.desc(), Transaction.id.desc()).first()


def create_scored_transaction(
    db: Session,
    *,
    model_service: Any,
    threshold: float,
    predict_payload: PredictRequest,
    actor: str,
    user_sub: str | None = None,
    order_amount_inr: float | None = None,
    tenure_months: int | None = None,
    monthly_income_inr: float | None = None,
    bank: str | None = None,
    card_type: str | None = None,
    card_last_four: str | None = None,
    idempotency_key: str | None = None,
    request_metadata: dict[str, Any] | None = None,
    audit_action: str = "Application scored",
) -> Transaction:
    existing = _get_idempotent_transaction(
        db,
        user_sub=user_sub,
        idempotency_key=idempotency_key,
    )
    if existing:
        _attach_score_context(
            existing,
            model_version="idempotent-replay",
            schema_version="risk-v2.0.0",
            calibration_bucket="replayed",
            reasons=[],
        )
        return existing

    prediction = model_service.predict(predict_payload)
    risk_probability = float(getattr(prediction, "risk_probability", 0.0))
    source = str(getattr(prediction, "source", "local"))
    model_version = str(getattr(prediction, "model_version", "unknown-model"))
    schema_version = str(getattr(prediction, "schema_version", "risk-v2.0.0"))
    calibration_bucket = str(getattr(prediction, "calibration_bucket", "unknown"))
    reasons = _serialize_reasons(getattr(prediction, "reasons", []))

    auto_decision = _resolve_decision(float(risk_probability), threshold)
    final_decision: Decision = auto_decision

    transaction = Transaction(
        application_uuid=str(uuid4()),
        user_sub=user_sub,
        idempotency_key=idempotency_key,
        order_amount_inr=order_amount_inr,
        tenure_months=tenure_months,
        monthly_income_inr=monthly_income_inr,
        bank=bank,
        card_type=card_type,
        card_last_four_masked=_mask_card_last_four(card_last_four),
        avg_monthly_inflow=predict_payload.monthly_inflow,
        inflow_volatility=predict_payload.inflow_volatility_90d,
        avg_monthly_outflow=predict_payload.monthly_outflow,
        min_balance_30d=predict_payload.min_balance_30d,
        neg_balance_days_30d=predict_payload.negative_balance_days_30d,
        purchase_to_inflow_ratio=predict_payload.purchase_to_inflow_ratio,
        total_burden_ratio=predict_payload.total_burden_ratio,
        buffer_ratio=predict_payload.buffer_ratio,
        stress_index=predict_payload.stress_index,
        risk_probability=float(risk_probability),
        model_source=source,
        auto_decision=auto_decision,
        final_decision=final_decision,
        decision_source="auto",
        decision=final_decision,
    )
    db.add(transaction)
    db.flush()
    db.refresh(transaction)
    _attach_score_context(
        transaction,
        model_version=model_version,
        schema_version=schema_version,
        calibration_bucket=calibration_bucket,
        reasons=reasons,
    )

    metadata_note = ""
    if request_metadata:
        metadata_note = " | metadata captured"

    create_audit_log(
        db,
        actor=actor,
        action=audit_action,
        details=(
            f"Decision {final_decision} (risk {float(risk_probability):.3f}) "
            f"for APP-{transaction.application_uuid}{metadata_note}"
        ),
        status="success" if source == "ml_service" else "warning",
        entity_id=str(transaction.id),
        source=source,
        commit=False,
        refresh=False,
    )

    db.commit()
    db.refresh(transaction)
    return transaction


def create_transaction_from_checkout(
    db: Session,
    *,
    model_service: Any,
    threshold: float,
    actor: str,
    user_sub: str | None,
    payload: CreateApplicationRequest,
    idempotency_key: str | None = None,
) -> Transaction:
    predict_payload = _derive_predict_payload(payload)
    return create_scored_transaction(
        db,
        model_service=model_service,
        threshold=threshold,
        predict_payload=predict_payload,
        actor=actor,
        user_sub=user_sub,
        order_amount_inr=payload.order_amount_inr,
        tenure_months=payload.tenure_months,
        monthly_income_inr=payload.monthly_income_inr,
        bank=payload.bank,
        card_type=payload.card_type,
        card_last_four=payload.card_last_four,
        idempotency_key=idempotency_key,
        request_metadata=payload.metadata,
    )


def get_application_by_uuid(db: Session, application_uuid: str) -> Transaction | None:
    return (
        db.query(Transaction)
        .filter(Transaction.application_uuid == application_uuid)
        .first()
    )


def _normalize_status_filter(status: str | None) -> Decision | None:
    if not status:
        return None
    normalized = status.strip().lower()
    if normalized in {"approve", "approved"}:
        return "Approve"
    if normalized in {"decline", "declined", "rejected"}:
        return "Decline"
    return None


def list_admin_applications(
    db: Session,
    *,
    page: int,
    limit: int,
    status: str | None = None,
    search: str | None = None,
) -> tuple[list[Transaction], int, int]:
    query = db.query(Transaction)

    status_filter = _normalize_status_filter(status)
    if status_filter:
        query = query.filter(func.coalesce(Transaction.final_decision, Transaction.decision) == status_filter)

    if search:
        like = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Transaction.application_uuid.ilike(like),
                Transaction.user_sub.ilike(like),
                Transaction.bank.ilike(like),
                Transaction.card_last_four_masked.ilike(like),
                cast(Transaction.id, String).ilike(like),
            )
        )

    total = query.with_entities(func.count(Transaction.id)).scalar() or 0
    total_pages = max(1, math.ceil(total / limit)) if total else 1
    offset = (page - 1) * limit
    items = (
        query.order_by(Transaction.created_at.desc(), Transaction.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return items, int(total), total_pages


def list_user_applications(
    db: Session,
    *,
    user_sub: str,
    page: int,
    limit: int,
) -> tuple[list[Transaction], int, int]:
    query = db.query(Transaction).filter(Transaction.user_sub == user_sub)
    total = query.with_entities(func.count(Transaction.id)).scalar() or 0
    total_pages = max(1, math.ceil(total / limit)) if total else 1
    offset = (page - 1) * limit
    items = (
        query.order_by(Transaction.created_at.desc(), Transaction.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return items, int(total), total_pages


def override_application_decision(
    db: Session,
    *,
    application_uuid: str,
    decision: Decision,
    reason: str,
    actor: str,
) -> Transaction:
    transaction = get_application_by_uuid(db, application_uuid)
    if transaction is None:
        raise LookupError("Application not found")

    transaction.final_decision = decision
    transaction.decision = decision
    transaction.decision_source = "manual_override"
    transaction.override_reason = reason
    transaction.reviewed_by = actor
    transaction.reviewed_at = datetime.now(UTC)
    transaction.updated_at = datetime.now(UTC)

    create_audit_log(
        db,
        actor=actor,
        action="Manual override",
        details=f"Application APP-{transaction.application_uuid} manually set to {decision}: {reason}",
        status="warning",
        entity_id=str(transaction.id),
        source="manual_override",
        commit=False,
        refresh=False,
    )

    db.commit()
    db.refresh(transaction)
    return transaction


def serialize_application(transaction: Transaction) -> dict[str, Any]:
    auto_decision = transaction.auto_decision or transaction.decision
    final_decision = transaction.final_decision or transaction.decision
    decision_source = transaction.decision_source or "auto"
    application_uuid = transaction.application_uuid or f"legacy-{transaction.id}"
    updated_at = transaction.updated_at or transaction.created_at

    return {
        "id": transaction.id,
        "application_uuid": application_uuid,
        "user_sub": transaction.user_sub,
        "order_amount_inr": transaction.order_amount_inr,
        "tenure_months": transaction.tenure_months,
        "monthly_income_inr": transaction.monthly_income_inr,
        "bank": transaction.bank,
        "card_type": transaction.card_type,
        "card_last_four_masked": transaction.card_last_four_masked,
        "avg_monthly_inflow": float(transaction.avg_monthly_inflow),
        "inflow_volatility": float(transaction.inflow_volatility),
        "avg_monthly_outflow": float(transaction.avg_monthly_outflow),
        "min_balance_30d": float(transaction.min_balance_30d),
        "neg_balance_days_30d": int(transaction.neg_balance_days_30d),
        "purchase_to_inflow_ratio": float(transaction.purchase_to_inflow_ratio),
        "total_burden_ratio": float(transaction.total_burden_ratio),
        "buffer_ratio": float(transaction.buffer_ratio),
        "stress_index": float(transaction.stress_index),
        "risk_probability": float(transaction.risk_probability),
        "model_source": transaction.model_source,
        "auto_decision": auto_decision,
        "final_decision": final_decision,
        "decision_source": decision_source,
        "decision": final_decision,
        "reviewed_by": transaction.reviewed_by,
        "reviewed_at": transaction.reviewed_at,
        "override_reason": transaction.override_reason,
        "created_at": transaction.created_at,
        "updated_at": updated_at,
    }
