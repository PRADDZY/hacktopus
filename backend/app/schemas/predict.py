from typing import Literal

from pydantic import BaseModel, Field, field_validator


class PredictRequest(BaseModel):
    segment: str = Field(..., description="Applicant segment (e.g. gig_worker, student)")
    monthly_inflow: float = Field(..., gt=0, description="Average monthly inflow")
    monthly_outflow: float = Field(..., ge=0, description="Average monthly outflow")
    inflow_volatility_90d: float = Field(..., ge=0, description="90-day inflow volatility")
    outflow_volatility_90d: float = Field(..., ge=0, description="90-day outflow volatility")
    deposit_count_30d: int = Field(..., ge=0, description="Deposit count in last 30 days")
    days_since_last_income: int = Field(..., ge=0, description="Days since last income credit")
    avg_balance_30d: float = Field(..., description="Average balance in last 30 days")
    min_balance_30d: float = Field(..., description="Minimum balance in last 30 days")
    negative_balance_days_30d: int = Field(..., ge=0, description="Negative balance days in last 30 days")
    essential_spend_ratio: float = Field(..., ge=0, description="Essential spend ratio")
    active_loan_count: int = Field(..., ge=0, description="Active loan count")
    monthly_installment_burden: float = Field(..., ge=0, description="Monthly installment burden")
    purchase_amount: float = Field(..., ge=0, description="Purchase amount under evaluation")
    tenure_weeks: int = Field(..., ge=1, description="Requested tenure in weeks")
    purchase_to_inflow_ratio: float = Field(..., ge=0, description="Purchase to inflow ratio")
    installment_to_inflow_ratio: float = Field(..., ge=0, description="Installment to inflow ratio")
    total_burden_ratio: float = Field(..., ge=0, description="Total burden ratio")
    buffer_ratio: float = Field(..., ge=0, description="Buffer ratio")
    stress_index: float = Field(..., ge=0, description="Stress index")

    @field_validator("*")
    @classmethod
    def validate_numeric_values(cls, value):
        if isinstance(value, str):
            if not value.strip():
                raise ValueError("Value cannot be empty")
            return value
        if isinstance(value, (float, int)):
            if value != value:
                raise ValueError("Value cannot be NaN")
            if value in (float("inf"), float("-inf")):
                raise ValueError("Value cannot be infinite")
        return value


class PredictionReason(BaseModel):
    code: str
    feature: str
    direction: Literal["up", "down"]
    impact: float
    message: str


class PredictResponse(BaseModel):
    risk_probability: float
    decision: Literal["Approve", "Decline"]
    model_version: str
    schema_version: str
    calibration_bucket: str
    reasons: list[PredictionReason]
