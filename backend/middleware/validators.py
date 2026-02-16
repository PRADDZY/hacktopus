from models.schemas import BuyerFinancialInput
from typing import Tuple, Optional, List

def validate_input(data: BuyerFinancialInput) -> Tuple[bool, Optional[List[str]]]:
    """
    Validate frontend input before sending to ML
    Returns: (is_valid, error_messages)
    """
    errors = []
    
    # Basic validations
    if data.credit_score < 300 or data.credit_score > 900:
        errors.append("Credit score must be between 300 and 900")
    
    if data.monthly_income <= 0:
        errors.append("Monthly income must be positive")
    
    if data.purchase_amount <= 0:
        errors.append("Purchase amount must be positive")
    
    if data.emi_tenure_months < 3 or data.emi_tenure_months > 60:
        errors.append("EMI tenure must be between 3 and 60 months")
    
    # Logical validations
    if data.fixed_expenses > data.monthly_income:
        errors.append("Fixed expenses cannot exceed income")
    
    if data.existing_emi_amount > data.monthly_income:
        errors.append("Existing EMI cannot exceed income")
    
    # Calculate proposed EMI
    proposed_emi = data.purchase_amount / data.emi_tenure_months
    total_obligations = data.fixed_expenses + data.existing_emi_amount + proposed_emi
    
    if total_obligations > data.monthly_income:
        errors.append("Total obligations would exceed income")
    
    return len(errors) == 0, errors if errors else None

def calculate_metrics(data: BuyerFinancialInput) -> dict:
    """Calculate derived financial metrics"""
    proposed_emi = data.purchase_amount / data.emi_tenure_months
    
    # DTI Ratio
    total_debt = data.existing_emi_amount + proposed_emi
    dti_ratio = total_debt / data.monthly_income
    
    # FOIR
    total_obligations = data.existing_emi_amount + data.fixed_expenses
    foir = total_obligations / data.monthly_income
    
    # Savings in months
    savings_months = data.savings_buffer / data.monthly_income if data.monthly_income > 0 else 0
    
    # Disposable income
    disposable_income = data.monthly_income - total_debt - data.fixed_expenses
    
    return {
        "dti_ratio": round(dti_ratio, 4),
        "foir": round(foir, 4),
        "savings_months": round(savings_months, 2),
        "proposed_monthly_emi": round(proposed_emi, 2),
        "disposable_income": round(disposable_income, 2)
    }

def classify_income_group(monthly_income: float) -> str:
    """Classify income for fairness monitoring"""
    if monthly_income < 30000:
        return "Low"
    elif monthly_income < 75000:
        return "Medium"
    else:
        return "High"