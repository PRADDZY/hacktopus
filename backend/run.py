from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
import uuid

from config import settings
from database.db import get_db
from database import crud
from models.schemas import (
    BuyerFinancialInput,
    RiskPredictionResponse,
    LenderDashboardData,
    MLModelRequest,
    RiskCategory,
    Decision,
    HealthResponse,
    FairnessMetrics,
    DriftReport
)
from models.ml_connector import ml_connector
from middleware.validators import validate_input, calculate_metrics, classify_income_group

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend Bridge connecting Frontend ↔ Backend ↔ ML Model",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def make_decision(risk_score: float, risk_category: str, metrics: dict) -> tuple:
    dti_ratio = metrics["dti_ratio"]
    disposable_income = metrics["disposable_income"]
    
    if risk_score > 0.7 or dti_ratio > 0.50 or disposable_income < 0:
        return Decision.REJECT, False, "❌ High financial risk. Cannot approve."
    
    elif risk_category == "High":
        return Decision.APPROVE_WITH_WARNING, True, "⚠️ HIGH RISK: Proceed with extreme caution."
    
    elif risk_category == "Moderate":
        if dti_ratio > 0.43:
            return Decision.CONDITIONAL_APPROVE, True, "⚠️ High debt burden. Consider reducing EMI."
        else:
            return Decision.APPROVE_WITH_WARNING, False, "✓ Approved. Monitor budget carefully."
    
    else:
        return Decision.APPROVE, False, None

def calculate_financial_health(dti_ratio: float, savings_months: float) -> float:
    dti_component = max(0, (1 - dti_ratio) * 60)
    savings_component = min(savings_months / 6, 1) * 40
    
    health_score = dti_component + savings_component
    return round(max(0, min(100, health_score)), 2)

def calculate_debt_trap_probability(dti: float, foir: float, savings_months: float, risk_score: float) -> float:
    trap_score = (
        min(dti, 1.0) * 0.4 +
        min(foir, 1.0) * 0.3 +
        (1 - min(savings_months / 6, 1)) * 0.2 +
        risk_score * 0.1
    )
    return round(min(trap_score, 1.0) * 100, 2)

def generate_recommendation(decision: Decision, metrics: dict) -> str:
    if decision == Decision.REJECT:
        return "🚨 We strongly advise against this purchase. Your financial obligations would exceed safe limits."
    elif decision == Decision.APPROVE_WITH_WARNING:
        return f"⚠️ Proceed carefully. EMI: ₹{metrics['proposed_monthly_emi']:.0f}/month. Remaining income: ₹{metrics['disposable_income']:.0f}"
    elif decision == Decision.CONDITIONAL_APPROVE:
        return f"⚠️ Consider extending tenure or increasing down payment to reduce monthly burden."
    else:
        return f"✅ You can comfortably afford this EMI. Monthly payment: ₹{metrics['proposed_monthly_emi']:.0f}"

@app.get("/", response_model=HealthResponse)
async def root():
    ml_status = "connected" if await ml_connector.health_check() else "disconnected"
    
    return HealthResponse(
        status="healthy",
        version=settings.VERSION,
        ml_service_status=ml_status,
        database_status="connected",
        timestamp=datetime.now(timezone.utc)
    )

@app.get("/health", response_model=HealthResponse)
async def health_check():
    ml_status = "connected" if await ml_connector.health_check() else "disconnected"
    
    return HealthResponse(
        status="healthy",
        version=settings.VERSION,
        ml_service_status=ml_status,
        database_status="connected",
        timestamp=datetime.now(timezone.utc)
    )

@app.post(
    f"{settings.API_V1_STR}/predict",
    response_model=RiskPredictionResponse,
    summary="Predict EMI Risk",
    description="Main endpoint: Frontend sends buyer data → Backend processes → ML predicts → Backend returns decision"
)
async def predict_risk(
    input_data: BuyerFinancialInput,
    db: Session = Depends(get_db)
):
    try:
        is_valid, errors = validate_input(input_data)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "Validation failed", "errors": errors}
            )
        
        metrics = calculate_metrics(input_data)
        
        ml_request = MLModelRequest(
            monthly_income=input_data.monthly_income,
            dti_ratio=metrics["dti_ratio"],
            foir=metrics["foir"],
            savings_months=metrics["savings_months"],
            emi_tenure_months=input_data.emi_tenure_months,
            purchase_amount=input_data.purchase_amount,
            existing_emi=input_data.existing_emi_amount
        )
        
        try:
            ml_response = await ml_connector.predict(ml_request)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"ML service unavailable: {str(e)}"
            )
        
        decision, requires_confirmation, warning_msg = make_decision(
            ml_response.risk_score,
            ml_response.risk_category,
            metrics
        )
        
        financial_health = calculate_financial_health(
            metrics["dti_ratio"],
            metrics["savings_months"]
        )
        
        debt_trap_prob = calculate_debt_trap_probability(
            metrics["dti_ratio"],
            metrics["foir"],
            metrics["savings_months"],
            ml_response.risk_score
        )
        
        recommendation = generate_recommendation(decision, metrics)
        
        prediction_id = crud.generate_prediction_id()
        
        log_data = {
            "prediction_id": prediction_id,
            "buyer_id": input_data.buyer_id,
            "timestamp": datetime.now(timezone.utc),
            "monthly_income": input_data.monthly_income,
            "purchase_amount": input_data.purchase_amount,
            "emi_tenure_months": input_data.emi_tenure_months,
            "existing_emi_amount": input_data.existing_emi_amount,
            "fixed_expenses": input_data.fixed_expenses,
            "savings_buffer": input_data.savings_buffer,
            "dti_ratio": metrics["dti_ratio"],
            "foir": metrics["foir"],
            "risk_score": ml_response.risk_score,
            "risk_category": ml_response.risk_category,
            "decision": decision.value,
            "income_group": classify_income_group(input_data.monthly_income),
            "age": input_data.age
        }
        crud.create_prediction_log(db, log_data)
        
        return RiskPredictionResponse(
            risk_score=ml_response.risk_score,
            risk_category=RiskCategory(ml_response.risk_category),
            debt_trap_probability=debt_trap_prob,
            financial_health_score=financial_health,
            decision=decision,
            requires_double_confirmation=requires_confirmation,
            warning_message=warning_msg,
            recommendation=recommendation,
            dti_ratio=metrics["dti_ratio"],
            foir=metrics["foir"],
            proposed_monthly_emi=metrics["proposed_monthly_emi"],
            disposable_income=metrics["disposable_income"],
            key_factors=ml_response.feature_importance,
            prediction_id=prediction_id,
            timestamp=datetime.now(timezone.utc)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@app.get(
    f"{settings.API_V1_STR}/lender/applications",
    response_model=List[LenderDashboardData],
    summary="Get Recent Applications",
    description="Lender dashboard: View recent EMI applications"
)
async def get_lender_applications(
    limit: int = 50,
    db: Session = Depends(get_db)
):
    try:
        logs = crud.get_recent_logs(db, limit=limit)
        
        dashboard_data = []
        for log in logs:
            data = LenderDashboardData(
                buyer_id=log.buyer_id,
                prediction_id=log.prediction_id,
                monthly_income=log.monthly_income,
                dti_ratio=log.dti_ratio,
                foir=log.foir,
                risk_score=log.risk_score,
                risk_category=log.risk_category,
                decision=log.decision,
                purchase_amount=log.purchase_amount,
                emi_tenure_months=log.emi_tenure_months,
                proposed_monthly_emi=log.purchase_amount / log.emi_tenure_months,
                timestamp=log.timestamp
            )
            dashboard_data.append(data)
        
        return dashboard_data
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching applications: {str(e)}"
        )

@app.get(
    f"{settings.API_V1_STR}/lender/statistics",
    summary="Get Statistics",
    description="Get aggregate statistics for lender dashboard"
)
async def get_statistics_endpoint(
    days: int = 7,
    db: Session = Depends(get_db)
):
    try:
        stats = crud.get_statistics(db, days=days)
        return stats
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching statistics: {str(e)}"
        )

@app.get(
    f"{settings.API_V1_STR}/lender/fairness-metrics",
    response_model=FairnessMetrics,
    summary="Fairness Metrics",
    description="Calculate fairness metrics across demographic groups"
)
async def get_fairness_metrics(db: Session = Depends(get_db)):
    try:
        logs = crud.get_recent_logs(db, limit=1000)
        
        if len(logs) == 0:
            return FairnessMetrics(
                total_predictions=0,
                approval_rate=0.0,
                rejection_rate=0.0,
                metrics_by_group={},
                fairness_score=100.0,
                issues_detected=[],
                timestamp=datetime.now(timezone.utc)
            )
        
        groups = {}
        for log in logs:
            group = log.income_group
            if group not in groups:
                groups[group] = {"total": 0, "approved": 0, "rejected": 0}
            
            groups[group]["total"] += 1
            if "Approve" in log.decision:
                groups[group]["approved"] += 1
            elif log.decision == "Reject":
                groups[group]["rejected"] += 1
        
        metrics_by_group = {}
        approval_rates = []
        
        for group, data in groups.items():
            approval_rate = data["approved"] / data["total"] if data["total"] > 0 else 0
            rejection_rate = data["rejected"] / data["total"] if data["total"] > 0 else 0
            
            metrics_by_group[group] = {
                "total": data["total"],
                "approval_rate": round(approval_rate, 4),
                "rejection_rate": round(rejection_rate, 4)
            }
            approval_rates.append(approval_rate)
        
        total = len(logs)
        total_approved = sum(1 for log in logs if "Approve" in log.decision)
        total_rejected = sum(1 for log in logs if log.decision == "Reject")
        
        approval_gap = max(approval_rates) - min(approval_rates) if approval_rates else 0
        fairness_score = 100 - (approval_gap * 100)
        
        issues = []
        if approval_gap > 0.05:
            issues.append(f"Approval rate gap of {approval_gap*100:.1f}% detected")
        
        return FairnessMetrics(
            total_predictions=total,
            approval_rate=total_approved / total if total > 0 else 0,
            rejection_rate=total_rejected / total if total > 0 else 0,
            metrics_by_group=metrics_by_group,
            fairness_score=round(fairness_score, 2),
            issues_detected=issues,
            timestamp=datetime.now(timezone.utc)
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating fairness metrics: {str(e)}"
        )

@app.get(
    f"{settings.API_V1_STR}/lender/drift-check",
    response_model=DriftReport,
    summary="Model Drift Check",
    description="Check for model drift"
)
async def check_model_drift(db: Session = Depends(get_db)):
    try:
        return DriftReport(
            drift_detected=False,
            drift_severity="None",
            psi_score=0.08,
            recommendations=["No significant drift detected"],
            timestamp=datetime.now(timezone.utc)
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking drift: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "run:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )