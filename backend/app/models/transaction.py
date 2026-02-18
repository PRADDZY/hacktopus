from sqlalchemy import Column, DateTime, Float, Integer, String, func

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
    decision = Column(String(20), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
