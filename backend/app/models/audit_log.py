from sqlalchemy import Column, DateTime, Integer, String, Text, func

from ..core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor = Column(String(80), nullable=False, index=True)
    action = Column(String(120), nullable=False, index=True)
    details = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, index=True)
    entity_id = Column(String(120), nullable=True, index=True)
    source = Column(String(40), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
