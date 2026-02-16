from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PredictRequest(BaseModel):
    avg_monthly_inflow: float = Field(..., description="Average monthly inflow")
    inflow_volatility: float = Field(..., description="Inflow volatility")
    avg_monthly_outflow: float = Field(..., description="Average monthly outflow")
    min_balance_30d: float = Field(..., description="Minimum 30-day balance")
    neg_balance_days_30d: int = Field(..., ge=0, description="Negative balance days in last 30 days")
    purchase_to_inflow_ratio: float = Field(..., description="Purchase to inflow ratio")
    total_burden_ratio: float = Field(..., description="Total burden ratio")
    buffer_ratio: float = Field(..., description="Buffer ratio")
    stress_index: float = Field(..., description="Stress index")

    @field_validator("*")
    @classmethod
    def validate_numeric_values(cls, value: float) -> float:
        if isinstance(value, (float, int)):
            if value != value:  # NaN check
                raise ValueError("Value cannot be NaN")
            if value in (float("inf"), float("-inf")):
                raise ValueError("Value cannot be infinite")
        return value


class PredictResponse(BaseModel):
    risk_probability: float
    decision: Literal["Approve", "Decline"]


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


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    threshold: float
