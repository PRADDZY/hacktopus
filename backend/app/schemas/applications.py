from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Decision = Literal["Approve", "Decline"]
DecisionSource = Literal["auto", "manual_override"]


class CreateApplicationRequest(BaseModel):
    order_amount_inr: float = Field(..., gt=0, description="Order amount in INR")
    tenure_months: int = Field(..., ge=1, le=36, description="Requested EMI tenure in months")
    bank: str = Field(..., min_length=2, max_length=120, description="Selected lending bank")
    monthly_income_inr: float = Field(..., gt=0, description="User monthly income in INR")
    card_type: Literal["credit", "fairlens"] = Field(..., description="Card/account type used for EMI")
    card_last_four: str = Field(..., min_length=4, max_length=4, description="Last four digits of card/account")
    metadata: dict[str, Any] | None = Field(default=None, description="Optional request metadata")

    @field_validator("card_last_four")
    @classmethod
    def validate_card_last_four(cls, value: str) -> str:
        if not value.isdigit():
            raise ValueError("card_last_four must contain only digits")
        return value


class ApplicationItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    application_uuid: str
    user_sub: str | None = None
    order_amount_inr: float | None = None
    tenure_months: int | None = None
    monthly_income_inr: float | None = None
    bank: str | None = None
    card_type: str | None = None
    card_last_four_masked: str | None = None
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
    model_source: str | None = None
    auto_decision: Decision
    final_decision: Decision
    decision_source: DecisionSource
    decision: Decision
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None
    override_reason: str | None = None
    created_at: datetime
    updated_at: datetime


class ApplicationListResponse(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int
    items: list[ApplicationItem]


class AdminOverrideRequest(BaseModel):
    decision: Decision
    reason: str = Field(..., min_length=3, max_length=500)

