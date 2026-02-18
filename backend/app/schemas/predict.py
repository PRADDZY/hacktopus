from typing import Literal

from pydantic import BaseModel, Field, field_validator


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
            if value != value:
                raise ValueError("Value cannot be NaN")
            if value in (float("inf"), float("-inf")):
                raise ValueError("Value cannot be infinite")
        return value


class PredictResponse(BaseModel):
    risk_probability: float
    decision: Literal["Approve", "Decline"]
