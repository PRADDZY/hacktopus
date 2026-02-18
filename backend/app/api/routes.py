from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..schemas import (
    AuditLogsResponse,
    HealthResponse,
    LogsResponse,
    PredictRequest,
    PredictResponse,
    StatsResponse,
)
from ..services import create_audit_log, create_transaction, get_audit_logs, get_logs, get_stats

router = APIRouter()


@router.get("/", response_model=HealthResponse)
def root(request: Request) -> HealthResponse:
    return HealthResponse(
        status="ok",
        model_loaded=True,
        threshold=float(request.app.state.threshold),
    )


@router.get("/health", response_model=HealthResponse)
def health(request: Request) -> HealthResponse:
    return HealthResponse(
        status="ok",
        model_loaded=True,
        threshold=float(request.app.state.threshold),
    )


@router.post("/predict", response_model=PredictResponse)
def predict(
    payload: PredictRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> PredictResponse:
    try:
        risk_probability, source = request.app.state.model_service.predict(payload)
        decision = "Decline" if risk_probability >= request.app.state.threshold else "Approve"

        transaction = create_transaction(
            db=db,
            payload=payload,
            risk_probability=risk_probability,
            decision=decision,
            commit=False,
            refresh=True,
        )

        status = "success" if source == "ml_service" else "warning"
        details = f"Decision {decision} (risk {risk_probability:.3f}) for TXN-{transaction.id}"
        create_audit_log(
            db,
            actor="Risk Engine",
            action="Risk decision",
            details=details,
            status=status,
            entity_id=str(transaction.id),
            source=source,
            commit=False,
            refresh=False,
        )

        db.commit()

        return PredictResponse(
            risk_probability=round(float(risk_probability), 6),
            decision=decision,
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc


@router.get("/stats", response_model=StatsResponse)
def stats(db: Session = Depends(get_db)) -> StatsResponse:
    return StatsResponse(**get_stats(db))


@router.get("/logs", response_model=LogsResponse)
def logs(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
) -> LogsResponse:
    items, total, total_pages = get_logs(db=db, page=page, limit=limit)
    return LogsResponse(
        page=page,
        limit=limit,
        total=total,
        total_pages=total_pages,
        items=items,
    )


@router.get("/audit-logs", response_model=AuditLogsResponse)
def audit_logs(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=200),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> AuditLogsResponse:
    items, total, total_pages = get_audit_logs(
        db=db,
        page=page,
        limit=limit,
        status=status,
        search=search,
    )
    return AuditLogsResponse(
        page=page,
        limit=limit,
        total=total,
        total_pages=total_pages,
        items=items,
    )
