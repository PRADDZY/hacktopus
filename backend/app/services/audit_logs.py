import math

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..models import AuditLog


def create_audit_log(
    db: Session,
    *,
    actor: str,
    action: str,
    details: str,
    status: str,
    entity_id: str | None = None,
    source: str | None = None,
    commit: bool = True,
    refresh: bool = True,
) -> AuditLog:
    log = AuditLog(
        actor=actor,
        action=action,
        details=details,
        status=status,
        entity_id=entity_id,
        source=source,
    )
    db.add(log)
    if commit:
        db.commit()
        if refresh:
            db.refresh(log)
    else:
        db.flush()
        if refresh:
            db.refresh(log)
    return log


def get_audit_logs(
    db: Session,
    *,
    page: int,
    limit: int,
    status: str | None = None,
    search: str | None = None,
) -> tuple[list[AuditLog], int, int]:
    query = db.query(AuditLog)

    if status:
        query = query.filter(AuditLog.status == status)

    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                AuditLog.action.ilike(like),
                AuditLog.details.ilike(like),
                AuditLog.actor.ilike(like),
                AuditLog.entity_id.ilike(like),
            )
        )

    total = query.with_entities(func.count(AuditLog.id)).scalar() or 0
    total_pages = max(1, math.ceil(total / limit)) if total else 1
    offset = (page - 1) * limit

    items = (
        query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return items, int(total), total_pages
