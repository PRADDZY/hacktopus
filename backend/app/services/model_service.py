from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx
import joblib
import pandas as pd
import xgboost as xgb

from ..core.config import Settings
from ..schemas import PredictRequest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
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


class ModelService:
    def __init__(
        self,
        model: Any,
        threshold: float,
        feature_columns: list[str],
        ml_service_url: str,
        ml_service_timeout: float,
        local_source: str,
    ) -> None:
        self.model = model
        self.threshold = threshold
        self.feature_columns = feature_columns
        self.ml_service_url = ml_service_url
        self.ml_service_timeout = ml_service_timeout
        self.local_source = local_source

    @classmethod
    def from_settings(cls, settings: Settings) -> "ModelService":
        model_path, metadata_path = _resolve_model_paths(settings)
        metadata = _load_metadata(metadata_path)
        model, local_source = _load_local_model(model_path)
        return cls(
            model=model,
            threshold=float(metadata["threshold"]),
            feature_columns=list(metadata["feature_columns"]),
            ml_service_url=settings.ml_service_url,
            ml_service_timeout=float(settings.ml_service_timeout),
            local_source=local_source,
        )

    def predict(self, payload: PredictRequest) -> tuple[float, str]:
        payload_row = _build_payload_row(payload)
        risk_probability = _request_ml_service(
            self.ml_service_url,
            self.ml_service_timeout,
            payload_row,
        )

        if risk_probability is not None:
            return float(risk_probability), "ml_service"

        input_row = pd.DataFrame([payload_row])
        missing_columns = [column for column in self.feature_columns if column not in input_row.columns]
        if missing_columns:
            raise ValueError(f"Missing feature columns: {missing_columns}")
        ordered_row = input_row[self.feature_columns]
        risk_probability = _predict_risk_probability(self.model, ordered_row)
        return float(risk_probability), self.local_source


def _resolve_model_paths(settings: Settings) -> tuple[Path, Path]:
    local_model_path = PROJECT_ROOT / "model" / "bnpl_cashflow_model.pkl"
    local_metadata_path = PROJECT_ROOT / "model" / "model_metadata.json"

    fallback_model_path = PROJECT_ROOT.parent / "ml-service" / "bnpl_cashflow_model.pkl"
    fallback_metadata_path = PROJECT_ROOT.parent / "ml-service" / "model_metadata.json"

    model_path = Path(settings.model_path) if settings.model_path else local_model_path
    metadata_path = (
        Path(settings.model_metadata_path) if settings.model_metadata_path else local_metadata_path
    )

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


def _load_local_model(model_path: Path) -> tuple[Any, str]:
    if model_path.exists():
        return joblib.load(model_path), "local_pkl"

    json_candidates = [
        PROJECT_ROOT / "model" / DEFAULT_JSON_MODEL_NAME,
        PROJECT_ROOT.parent / "ml-service" / DEFAULT_JSON_MODEL_NAME,
    ]
    json_model_path = next((path for path in json_candidates if path.exists()), None)
    if json_model_path is None:
        raise RuntimeError(
            f"Model file not found at {model_path}, and JSON fallback not found. "
            f"Set MODEL_PATH or add {DEFAULT_JSON_MODEL_NAME}."
        )
    booster = xgb.Booster()
    booster.load_model(str(json_model_path))
    return booster, "local_json"


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


def _build_payload_row(payload: PredictRequest) -> dict[str, Any]:
    return {
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


def _request_ml_service(url: str, timeout: float, payload: dict[str, Any]) -> float | None:
    try:
        response = httpx.post(f"{url}/predict", json=payload, timeout=timeout)
        response.raise_for_status()
        data = response.json()
        value = data.get("risk_probability")
        if value is None:
            raise ValueError("ML service response missing risk_probability")
        return float(value)
    except Exception:
        return None
