import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import crud
import models  # noqa: F401
from database import Base, engine, get_db
from schemas import HealthResponse, LogsResponse, PredictRequest, PredictResponse, StatsResponse

PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_FEATURE_COLUMNS = [
    "avg_monthly_inflow",
    "inflow_volatility",
    "avg_monthly_outflow",
    "min_balance_30d",
    "neg_balance_days_30d",
    "purchase_to_inflow_ratio",
    "total_burden_ratio",
    "buffer_ratio",
    "stress_index",
]


def _resolve_model_paths() -> tuple[Path, Path]:
    env_model_path = os.getenv("MODEL_PATH")
    env_metadata_path = os.getenv("MODEL_METADATA_PATH")

    local_model_path = PROJECT_ROOT / "model" / "bnpl_cashflow_model.pkl"
    local_metadata_path = PROJECT_ROOT / "model" / "model_metadata.json"

    fallback_model_path = PROJECT_ROOT.parent / "ml-service" / "bnpl_cashflow_model.pkl"
    fallback_metadata_path = PROJECT_ROOT.parent / "ml-service" / "model_metadata.json"

    model_path = Path(env_model_path) if env_model_path else local_model_path
    metadata_path = Path(env_metadata_path) if env_metadata_path else local_metadata_path

    if not model_path.exists() and fallback_model_path.exists():
        model_path = fallback_model_path
    if not metadata_path.exists() and fallback_metadata_path.exists():
        metadata_path = fallback_metadata_path

    return model_path, metadata_path


def _load_metadata(metadata_path: Path) -> dict[str, Any]:
    if not metadata_path.exists():
        return {"threshold": 0.55, "feature_columns": DEFAULT_FEATURE_COLUMNS}
    with metadata_path.open("r", encoding="utf-8") as file:
        metadata = json.load(file)
    threshold = float(metadata.get("threshold", 0.55))
    feature_columns = metadata.get("feature_columns", DEFAULT_FEATURE_COLUMNS)
    return {"threshold": threshold, "feature_columns": feature_columns}


def _predict_risk_probability(model: Any, row: pd.DataFrame) -> float:
    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(row)
        return float(probabilities[0][1])

    raw_prediction = model.predict(row)
    value = float(raw_prediction[0])
    if 0 <= value <= 1:
        return value
    raise ValueError("Model output is not a probability and predict_proba is unavailable.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    model_path, metadata_path = _resolve_model_paths()
    if not model_path.exists():
        raise RuntimeError(
            f"Model file not found at {model_path}. Set MODEL_PATH or place the model under backend/model."
        )

    metadata = _load_metadata(metadata_path)
    model = joblib.load(model_path)

    app.state.model = model
    app.state.threshold = float(metadata["threshold"])
    app.state.feature_columns = list(metadata["feature_columns"])

    yield


app = FastAPI(
    title="FairLens API",
    description="BNPL risk scoring backend for checkout and bank analytics dashboard.",
    version="1.0.0",
    lifespan=lifespan,
)

cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://localhost:5173",
)
allowed_origins = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_model=HealthResponse)
def root() -> HealthResponse:
    return HealthResponse(
        status="ok",
        model_loaded=True,
        threshold=app.state.threshold,
    )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        model_loaded=True,
        threshold=app.state.threshold,
    )


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest, db: Session = Depends(get_db)) -> PredictResponse:
    try:
        input_row = pd.DataFrame(
            [
                {
                    "avg_monthly_inflow": payload.avg_monthly_inflow,
                    "inflow_volatility": payload.inflow_volatility,
                    "avg_monthly_outflow": payload.avg_monthly_outflow,
                    "min_balance_30d": payload.min_balance_30d,
                    "neg_balance_days_30d": payload.neg_balance_days_30d,
                    "purchase_to_inflow_ratio": payload.purchase_to_inflow_ratio,
                    "total_burden_ratio": payload.total_burden_ratio,
                    "buffer_ratio": payload.buffer_ratio,
                    "stress_index": payload.stress_index,
                }
            ]
        )

        feature_columns = app.state.feature_columns
        missing_columns = [column for column in feature_columns if column not in input_row.columns]
        if missing_columns:
            raise HTTPException(status_code=500, detail=f"Missing feature columns: {missing_columns}")

        ordered_row = input_row[feature_columns]
        risk_probability = _predict_risk_probability(app.state.model, ordered_row)
        decision = "Decline" if risk_probability >= app.state.threshold else "Approve"

        crud.create_transaction(
            db=db,
            payload=payload,
            risk_probability=risk_probability,
            decision=decision,
        )

        return PredictResponse(
            risk_probability=round(risk_probability, 6),
            decision=decision,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc


@app.get("/stats", response_model=StatsResponse)
def stats(db: Session = Depends(get_db)) -> StatsResponse:
    return StatsResponse(**crud.get_stats(db))


@app.get("/logs", response_model=LogsResponse)
def logs(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
) -> LogsResponse:
    items, total, total_pages = crud.get_logs(db=db, page=page, limit=limit)
    return LogsResponse(
        page=page,
        limit=limit,
        total=total,
        total_pages=total_pages,
        items=items,
    )
