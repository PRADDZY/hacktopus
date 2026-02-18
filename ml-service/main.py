import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
import xgboost as xgb
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

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
DEFAULT_JSON_MODEL_NAME = "gig_bnpl_xgb_model.json"


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


class PredictResponse(BaseModel):
    risk_probability: float
    model_source: str


class MetadataResponse(BaseModel):
    threshold: float
    feature_columns: list[str]


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool


def _resolve_model_paths() -> tuple[Path, Path]:
    env_model_path = os.getenv("MODEL_PATH")
    env_metadata_path = os.getenv("MODEL_METADATA_PATH")

    local_model_path = PROJECT_ROOT / "bnpl_cashflow_model.pkl"
    local_metadata_path = PROJECT_ROOT / "model_metadata.json"

    model_path = Path(env_model_path) if env_model_path else local_model_path
    metadata_path = Path(env_metadata_path) if env_metadata_path else local_metadata_path

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
    if isinstance(model, xgb.Booster):
        prediction = model.predict(xgb.DMatrix(row))
        return float(prediction[0])
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
    model_path, metadata_path = _resolve_model_paths()
    metadata = _load_metadata(metadata_path)

    model_source = "pkl"
    if model_path.exists():
        model = joblib.load(model_path)
    else:
        json_candidates = [
            PROJECT_ROOT / DEFAULT_JSON_MODEL_NAME,
        ]
        json_model_path = next((path for path in json_candidates if path.exists()), None)
        if json_model_path is None:
            raise RuntimeError(
                f"Model file not found at {model_path}, and JSON fallback not found. "
                f"Set MODEL_PATH or add {DEFAULT_JSON_MODEL_NAME}."
            )
        booster = xgb.Booster()
        booster.load_model(str(json_model_path))
        model = booster
        model_source = "json"

    app.state.model = model
    app.state.model_source = model_source
    app.state.threshold = float(metadata["threshold"])
    app.state.feature_columns = list(metadata["feature_columns"])

    yield


app = FastAPI(
    title="FairLens ML Service",
    description="Model inference service for FairLens BNPL risk scoring.",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", model_loaded=True)


@app.get("/metadata", response_model=MetadataResponse)
def metadata() -> MetadataResponse:
    return MetadataResponse(
        threshold=app.state.threshold,
        feature_columns=app.state.feature_columns,
    )


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    try:
        input_row = pd.DataFrame([
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
        ])

        feature_columns = app.state.feature_columns
        missing_columns = [column for column in feature_columns if column not in input_row.columns]
        if missing_columns:
            raise HTTPException(status_code=500, detail=f"Missing feature columns: {missing_columns}")

        ordered_row = input_row[feature_columns]
        risk_probability = _predict_risk_probability(app.state.model, ordered_row)

        return PredictResponse(
            risk_probability=round(float(risk_probability), 6),
            model_source=app.state.model_source,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc
