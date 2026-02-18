from sqlalchemy.orm import Session
from database.db import PredictionLog as PredictionLogDB
from datetime import datetime, timedelta, timezone
from typing import List
import uuid

def create_prediction_log(db: Session, log_data: dict) -> PredictionLogDB:
    """Save prediction to database"""
    db_log = PredictionLogDB(**log_data)
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

def get_recent_logs(db: Session, limit: int = 50) -> List[PredictionLogDB]:
    """Get recent predictions"""
    return db.query(PredictionLogDB).order_by(
        PredictionLogDB.timestamp.desc()
    ).limit(limit).all()

def get_logs_by_buyer(db: Session, buyer_id: str) -> List[PredictionLogDB]:
    """Get all predictions for a buyer"""
    return db.query(PredictionLogDB).filter(
        PredictionLogDB.buyer_id == buyer_id
    ).all()

def get_statistics(db: Session, days: int = 7) -> dict:
    """Get aggregate statistics"""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    logs = db.query(PredictionLogDB).filter(
        PredictionLogDB.timestamp >= cutoff
    ).all()
    
    total = len(logs)
    if total == 0:
        return {
            "total_predictions": 0,
            "approval_rate": 0,
            "rejection_rate": 0,
            "avg_risk_score": 0
        }
    
    approved = len([l for l in logs if "Approve" in l.decision])
    rejected = len([l for l in logs if l.decision == "Reject"])
    avg_risk = sum(l.risk_score for l in logs) / total
    
    return {
        "total_predictions": total,
        "approval_rate": approved / total,
        "rejection_rate": rejected / total,
        "avg_risk_score": avg_risk
    }

def generate_prediction_id() -> str:
    """Generate unique prediction ID"""
    return f"PRED_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6].upper()}"