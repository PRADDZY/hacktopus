from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy.orm import Session

from ..core import AuthUser, get_current_user, require_admin_user, require_authenticated_user
from ..core.database import get_db
from ..schemas import (
    AdminOverrideRequest,
    ApplicationItem,
    ApplicationListResponse,
    AuditLogsResponse,
    AuthMeResponse,
    CreateApplicationRequest,
    HealthResponse,
    LogsResponse,
    PredictRequest,
    PredictResponse,
    StatsResponse,
)
from ..services import (
    create_scored_transaction,
    create_transaction_from_checkout,
    get_application_by_uuid,
    get_audit_logs,
    get_logs,
    get_stats,
    list_admin_applications,
    list_user_applications,
    override_application_decision,
    serialize_application,
)

router = APIRouter()


def _resolve_actor(user: AuthUser, default: str) -> str:
    return user.email or user.subject or default


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


@router.get("/auth/me", response_model=AuthMeResponse)
def auth_me(user: AuthUser = Depends(get_current_user)) -> AuthMeResponse:
    return AuthMeResponse(
        is_authenticated=user.is_authenticated,
        subject=user.subject,
        email=user.email,
        roles=list(user.roles),
    )


@router.post("/predict", response_model=PredictResponse)
def predict(
    payload: PredictRequest,
    request: Request,
    user: AuthUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> PredictResponse:
    try:
        actor = _resolve_actor(user, "Risk Engine")
        transaction = create_scored_transaction(
            db,
            model_service=request.app.state.model_service,
            threshold=float(request.app.state.threshold),
            predict_payload=payload,
            actor=actor,
            user_sub=user.subject,
            idempotency_key=idempotency_key,
            audit_action="Risk decision",
        )
        final_decision = transaction.final_decision or transaction.decision
        model_version = str(getattr(transaction, "_model_version", "unknown-model"))
        schema_version = str(getattr(transaction, "_schema_version", "risk-v2.0.0"))
        calibration_bucket = str(getattr(transaction, "_calibration_bucket", "unknown"))
        reasons = list(getattr(transaction, "_reasons", []))
        return PredictResponse(
            risk_probability=round(float(transaction.risk_probability), 6),
            decision=final_decision,
            model_version=model_version,
            schema_version=schema_version,
            calibration_bucket=calibration_bucket,
            reasons=reasons,
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc


@router.post("/v1/applications", response_model=ApplicationItem)
def create_application(
    payload: CreateApplicationRequest,
    request: Request,
    user: AuthUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> ApplicationItem:
    try:
        actor = _resolve_actor(user, "Checkout User")
        transaction = create_transaction_from_checkout(
            db,
            model_service=request.app.state.model_service,
            threshold=float(request.app.state.threshold),
            actor=actor,
            user_sub=user.subject,
            payload=payload,
            idempotency_key=idempotency_key,
        )
        return ApplicationItem(**serialize_application(transaction))
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create application: {exc}") from exc


@router.get("/v1/applications/me", response_model=ApplicationListResponse)
def list_my_applications(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=200),
    user: AuthUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> ApplicationListResponse:
    if not user.subject:
        return ApplicationListResponse(page=page, limit=limit, total=0, total_pages=1, items=[])

    items, total, total_pages = list_user_applications(
        db,
        user_sub=user.subject,
        page=page,
        limit=limit,
    )
    return ApplicationListResponse(
        page=page,
        limit=limit,
        total=total,
        total_pages=total_pages,
        items=[ApplicationItem(**serialize_application(item)) for item in items],
    )


@router.get("/v1/admin/applications", response_model=ApplicationListResponse)
def list_admin_applications_endpoint(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=200),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    _: AuthUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> ApplicationListResponse:
    items, total, total_pages = list_admin_applications(
        db,
        page=page,
        limit=limit,
        status=status,
        search=search,
    )
    return ApplicationListResponse(
        page=page,
        limit=limit,
        total=total,
        total_pages=total_pages,
        items=[ApplicationItem(**serialize_application(item)) for item in items],
    )


@router.get("/v1/admin/applications/{application_uuid}", response_model=ApplicationItem)
def get_admin_application(
    application_uuid: str,
    _: AuthUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> ApplicationItem:
    transaction = get_application_by_uuid(db, application_uuid)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return ApplicationItem(**serialize_application(transaction))


@router.post("/v1/admin/applications/{application_uuid}/override", response_model=ApplicationItem)
def override_admin_application(
    application_uuid: str,
    payload: AdminOverrideRequest,
    admin: AuthUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
    _: str | None = Header(default=None, alias="Idempotency-Key"),
) -> ApplicationItem:
    try:
        actor = _resolve_actor(admin, "Risk Ops")
        transaction = override_application_decision(
            db,
            application_uuid=application_uuid,
            decision=payload.decision,
            reason=payload.reason,
            actor=actor,
        )
        return ApplicationItem(**serialize_application(transaction))
    except LookupError as exc:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to override application: {exc}") from exc


@router.get("/stats", response_model=StatsResponse)
def stats(
    _: AuthUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> StatsResponse:
    return StatsResponse(**get_stats(db))


@router.get("/logs", response_model=LogsResponse)
def logs(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=200),
    _: AuthUser = Depends(require_admin_user),
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
    _: AuthUser = Depends(require_admin_user),
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
