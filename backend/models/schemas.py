from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, List
from datetime import datetime
from enum import Enum

class RiskCategory(str, Enum):
    LOW = "Low"
    MODERATE = "Moderate"
    HIGH = "High"

class Decision(str, Enum):
    APPROVE = "Approve"
    APPROVE_WITH_WARNING = "Approve with Warning"
    REJECT = "Reject"
    CONDITIONAL_APPROVE = "Conditional Approve"

class BuyerFinancialInput(BaseModel):
    buyer_id: str = Field(..., description="Unique buyer identifier")
    product_id: str = Field(..., description="Product being purchased")
    purchase_amount: float = Field(..., gt=0, description="Total purchase amount")
    emi_tenure_months: int = Field(..., ge=3, le=60, description="EMI tenure (3-60 months)")
    
    monthly_income: float = Field(..., gt=0, description="Monthly income")
    existing_emi_amount: float = Field(default=0, ge=0, description="Existing EMI obligations")
    fixed_expenses: float = Field(..., ge=0, description="Monthly fixed expenses")
    savings_buffer: float = Field(default=0, ge=0, description="Available savings")
    
    age: Optional[int] = Field(default=None, ge=18, le=100)
    
    class Config:
        json_schema_extra = {
            "example": {
                "buyer_id": "BUYER123",
                "product_id": "PROD456",
                "purchase_amount": 50000,
                "emi_tenure_months": 12,
                "monthly_income": 60000,
                "existing_emi_amount": 5000,
                "fixed_expenses": 20000,
                "savings_buffer": 100000,
                "age": 28
            }
        }

class MLModelRequest(BaseModel):
    monthly_income: float
    dti_ratio: float
    foir: float
    savings_months: float
    emi_tenure_months: int
    purchase_amount: float
    existing_emi: float

class MLModelResponse(BaseModel):
    risk_score: float = Field(..., description="Risk probability (0-1)")
    risk_category: str = Field(..., description="Low/Moderate/High")
    feature_importance: Dict[str, float] = Field(..., description="Feature contributions")
    
    confidence_score: Optional[float] = None
    model_version: Optional[str] = None

class RiskPredictionResponse(BaseModel):
    risk_score: float
    risk_category: RiskCategory
    debt_trap_probability: float
    financial_health_score: float
    
    decision: Decision
    requires_double_confirmation: bool
    warning_message: Optional[str]
    recommendation: str
    
    dti_ratio: float
    foir: float
    proposed_monthly_emi: float
    disposable_income: float
    
    key_factors: Dict[str, float]
    
    prediction_id: str
    timestamp: datetime
    
    class Config:
        json_schema_extra = {
            "example": {
                "risk_score": 0.35,
                "risk_category": "Moderate",
                "debt_trap_probability": 25.5,
                "financial_health_score": 72.3,
                "decision": "Approve with Warning",
                "requires_double_confirmation": True,
                "warning_message": "Moderate risk detected",
                "recommendation": "Proceed with caution",
                "dti_ratio": 0.38,
                "foir": 0.45,
                "proposed_monthly_emi": 4500,
                "disposable_income": 25000,
                "key_factors": {"dti_ratio": 0.35, "foir": 0.30},
                "prediction_id": "PRED_20250217_ABC123",
                "timestamp": "2025-02-17T10:30:00Z"
            }
        }

class LenderDashboardData(BaseModel):
    buyer_id: str
    prediction_id: str
    
    monthly_income: float
    dti_ratio: float
    foir: float
    
    risk_score: float
    risk_category: str
    decision: str
    
    purchase_amount: float
    emi_tenure_months: int
    proposed_monthly_emi: float
    
    timestamp: datetime

class FairnessMetrics(BaseModel):
    total_predictions: int
    approval_rate: float
    rejection_rate: float
    metrics_by_group: Dict
    fairness_score: float
    issues_detected: List[str]
    timestamp: datetime

class DriftReport(BaseModel):
    drift_detected: bool
    drift_severity: str
    psi_score: float
    recommendations: List[str]
    timestamp: datetime

class HealthResponse(BaseModel):
    status: str
    version: str
    ml_service_status: str
    database_status: str
    timestamp: datetime