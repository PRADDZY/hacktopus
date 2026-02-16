from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone
from config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class PredictionLog(Base):
    __tablename__ = "prediction_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    prediction_id = Column(String, unique=True, index=True)
    buyer_id = Column(String, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
    monthly_income = Column(Float)
    purchase_amount = Column(Float)
    emi_tenure_months = Column(Integer)
    existing_emi_amount = Column(Float)
    fixed_expenses = Column(Float)
    savings_buffer = Column(Float)
    
    dti_ratio = Column(Float)
    foir = Column(Float)
    
    risk_score = Column(Float)
    risk_category = Column(String)
    
    decision = Column(String)
    
    income_group = Column(String, index=True)
    age = Column(Integer, nullable=True)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()