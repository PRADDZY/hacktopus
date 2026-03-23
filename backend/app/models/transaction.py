from sqlalchemy import Column, DateTime, Float, Integer, String, Text, func

from ..core.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    avg_monthly_inflow = Column(Float, nullable=False)
    inflow_volatility = Column(Float, nullable=False)
    avg_monthly_outflow = Column(Float, nullable=False)
    min_balance_30d = Column(Float, nullable=False)
    neg_balance_days_30d = Column(Integer, nullable=False)
    purchase_to_inflow_ratio = Column(Float, nullable=False)
    total_burden_ratio = Column(Float, nullable=False)
    buffer_ratio = Column(Float, nullable=False)
    stress_index = Column(Float, nullable=False)
    risk_probability = Column(Float, nullable=False, index=True)
    application_uuid = Column(String(80), nullable=True, unique=True, index=True)
    user_sub = Column(String(200), nullable=True, index=True)
    idempotency_key = Column(String(100), nullable=True, index=True)
    order_amount_inr = Column(Float, nullable=True)
    tenure_months = Column(Integer, nullable=True)
    monthly_income_inr = Column(Float, nullable=True)
    bank = Column(String(120), nullable=True)
    card_type = Column(String(40), nullable=True)
    card_last_four_masked = Column(String(20), nullable=True)
    model_source = Column(String(40), nullable=True)
    auto_decision = Column(String(20), nullable=True, index=True)
    final_decision = Column(String(20), nullable=True, index=True)
    decision_source = Column(String(40), nullable=True, index=True)
    override_reason = Column(Text, nullable=True)
    reviewed_by = Column(String(200), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    decision = Column(String(20), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
