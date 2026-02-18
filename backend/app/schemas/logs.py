from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class StatsResponse(BaseModel):
    total_predictions: int
    approval_rate: float
    decline_rate: float
    risk_score_distribution: dict[str, int]


class LogItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    avg_monthly_inflow: float
    inflow_volatility: float
    avg_monthly_outflow: float
    min_balance_30d: float
    neg_balance_days_30d: int
    purchase_to_inflow_ratio: float
    total_burden_ratio: float
    buffer_ratio: float
    stress_index: float
    risk_probability: float
    decision: Literal["Approve", "Decline"]
    created_at: datetime


class LogsResponse(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int
    items: list[LogItem]


class AuditLogItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor: str
    action: str
    details: str
    status: Literal["success", "warning", "error"]
    entity_id: str | None = None
    source: str | None = None
    created_at: datetime


class AuditLogsResponse(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int
    items: list[AuditLogItem]
