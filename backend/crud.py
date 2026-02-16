import math

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Transaction
from schemas import PredictRequest


def create_transaction(
    db: Session,
    payload: PredictRequest,
    risk_probability: float,
    decision: str,
) -> Transaction:
    transaction = Transaction(
        avg_monthly_inflow=payload.avg_monthly_inflow,
        inflow_volatility=payload.inflow_volatility,
        avg_monthly_outflow=payload.avg_monthly_outflow,
        min_balance_30d=payload.min_balance_30d,
        neg_balance_days_30d=payload.neg_balance_days_30d,
        purchase_to_inflow_ratio=payload.purchase_to_inflow_ratio,
        total_burden_ratio=payload.total_burden_ratio,
        buffer_ratio=payload.buffer_ratio,
        stress_index=payload.stress_index,
        risk_probability=risk_probability,
        decision=decision,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


def get_stats(db: Session) -> dict:
    total_predictions = db.query(func.count(Transaction.id)).scalar() or 0
    if total_predictions == 0:
        return {
            "total_predictions": 0,
            "approval_rate": 0.0,
            "decline_rate": 0.0,
            "risk_score_distribution": {"low": 0, "medium": 0, "high": 0},
        }

    approval_count = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.decision == "Approve")
        .scalar()
        or 0
    )
    decline_count = total_predictions - approval_count

    low_count = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.risk_probability < 0.33)
        .scalar()
        or 0
    )
    medium_count = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.risk_probability >= 0.33, Transaction.risk_probability < 0.66)
        .scalar()
        or 0
    )
    high_count = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.risk_probability >= 0.66)
        .scalar()
        or 0
    )

    return {
        "total_predictions": int(total_predictions),
        "approval_rate": round(approval_count / total_predictions, 4),
        "decline_rate": round(decline_count / total_predictions, 4),
        "risk_score_distribution": {
            "low": int(low_count),
            "medium": int(medium_count),
            "high": int(high_count),
        },
    }


def get_logs(db: Session, page: int, limit: int) -> tuple[list[Transaction], int, int]:
    total = db.query(func.count(Transaction.id)).scalar() or 0
    total_pages = max(1, math.ceil(total / limit)) if total else 1
    offset = (page - 1) * limit

    items = (
        db.query(Transaction)
        .order_by(Transaction.created_at.desc(), Transaction.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return items, int(total), total_pages
