from __future__ import annotations

RISK_SCHEMA_VERSION = "risk-v2.0.0"
FEATURE_SCHEMA_VERSION = "statement-feature-v1"
MODEL_VERSION = "dual-target-catboost-lightgbm-v1"
PRIMARY_TARGET_COLUMN = "default_90d_proxy"
SECONDARY_TARGET_COLUMN = "affordability_stress_proxy"
BLEND_WEIGHTS = {
    PRIMARY_TARGET_COLUMN: 0.7,
    SECONDARY_TARGET_COLUMN: 0.3,
}

FEATURE_COLUMNS = [
    "segment_code",
    "monthly_inflow",
    "monthly_outflow",
    "inflow_volatility_90d",
    "outflow_volatility_90d",
    "deposit_count_30d",
    "days_since_last_income",
    "avg_balance_30d",
    "min_balance_30d",
    "negative_balance_days_30d",
    "essential_spend_ratio",
    "active_loan_count",
    "monthly_installment_burden",
    "purchase_amount",
    "tenure_weeks",
    "purchase_to_inflow_ratio",
    "installment_to_inflow_ratio",
    "total_burden_ratio",
    "buffer_ratio",
    "stress_index",
]

REASON_CODE_CATALOG = [
    "HIGH_TOTAL_BURDEN",
    "HIGH_STRESS_INDEX",
    "NEGATIVE_BALANCE_FREQUENCY",
    "INFLOW_VOLATILITY_PRESSURE",
    "CASHFLOW_LOAD",
    "BUFFER_STRENGTH",
    "INCOME_REGULARITY",
]

SEGMENT_CODE_MAP = {
    "student": 0,
    "gig_worker": 1,
    "informal_worker": 2,
    "salaried": 3,
    "self_employed": 4,
    "unknown": 5,
}

PROMOTION_GATES = {
    "min_recall_bad": 0.45,
    "min_approval_rate": 0.82,
    "min_segment_recall": 0.35,
    "max_segment_recall_gap": 0.40,
}
