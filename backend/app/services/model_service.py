from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import httpx
import joblib
import pandas as pd
import xgboost as xgb

from ..core.config import Settings
from ..schemas import PredictRequest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_VERSION = "risk-v2.0.0"
DEFAULT_MODEL_VERSION = "ensemble-catboost-ft-v1"
DEFAULT_FEATURE_COLUMNS = [
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
LEGACY_ALIAS_COLUMNS = {
    "avg_monthly_inflow": "monthly_inflow",
    "inflow_volatility": "inflow_volatility_90d",
    "avg_monthly_outflow": "monthly_outflow",
    "min_balance_30d": "min_balance_30d",
    "neg_balance_days_30d": "negative_balance_days_30d",
    "purchase_to_inflow_ratio": "purchase_to_inflow_ratio",
    "total_burden_ratio": "total_burden_ratio",
    "buffer_ratio": "buffer_ratio",
    "stress_index": "stress_index",
}
SEGMENT_MAP: dict[str, int] = {
    "student": 0,
    "gig_worker": 1,
    "informal_worker": 2,
    "salaried": 3,
    "self_employed": 4,
    "unknown": 5,
}
DEFAULT_JSON_MODEL_NAME = "gig_bnpl_xgb_model.json"


@dataclass(frozen=True)
class ScoreReason:
    code: str
    feature: str
    direction: Literal["up", "down"]
    impact: float
    message: str


@dataclass(frozen=True)
class ScoreResult:
    risk_probability: float
    source: str
    model_version: str
    schema_version: str
    calibration_bucket: str
    reasons: list[ScoreReason]


class ModelService:
    def __init__(
        self,
        model: Any,
        threshold: float,
        feature_columns: list[str],
        model_version: str,
        schema_version: str,
        ml_service_url: str,
        ml_service_timeout: float,
        local_source: str,
    ) -> None:
        self.model = model
        self.threshold = threshold
        self.feature_columns = feature_columns
        self.model_version = model_version
        self.schema_version = schema_version
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
            model_version=str(metadata["model_version"]),
            schema_version=str(metadata["schema_version"]),
            ml_service_url=settings.ml_service_url,
            ml_service_timeout=float(settings.ml_service_timeout),
            local_source=local_source,
        )

    def predict(self, payload: PredictRequest) -> ScoreResult:
        payload_row = _build_payload_row(payload)
        remote_result = _request_ml_service(
            self.ml_service_url,
            self.ml_service_timeout,
            payload_row,
            threshold=self.threshold,
        )
        if remote_result is not None:
            if isinstance(remote_result, (float, int)):
                risk_probability = float(remote_result)
                return ScoreResult(
                    risk_probability=risk_probability,
                    source="ml_service",
                    model_version=self.model_version,
                    schema_version=self.schema_version,
                    calibration_bucket=_calibration_bucket(risk_probability),
                    reasons=_derive_reasons(payload_row),
                )
            if isinstance(remote_result, dict):
                risk_probability = float(remote_result.get("risk_probability", 0.0))
                reasons = _normalize_reasons(remote_result.get("reasons"))
                if not reasons:
                    reasons = _derive_reasons(payload_row)
                return ScoreResult(
                    risk_probability=risk_probability,
                    source=str(remote_result.get("source", "ml_service")),
                    model_version=str(remote_result.get("model_version", self.model_version)),
                    schema_version=str(remote_result.get("schema_version", self.schema_version)),
                    calibration_bucket=str(
                        remote_result.get("calibration_bucket", _calibration_bucket(risk_probability))
                    ),
                    reasons=reasons,
                )
            return remote_result

        input_row = pd.DataFrame([payload_row])
        missing_columns = [column for column in self.feature_columns if column not in input_row.columns]
        if missing_columns:
            raise ValueError(f"Missing feature columns: {missing_columns}")

        ordered_row = input_row[self.feature_columns]
        risk_probability = _predict_risk_probability(self.model, ordered_row)
        return ScoreResult(
            risk_probability=float(risk_probability),
            source=self.local_source,
            model_version=self.model_version,
            schema_version=self.schema_version,
            calibration_bucket=_calibration_bucket(float(risk_probability)),
            reasons=_derive_reasons(payload_row),
        )


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
        return {
            "threshold": 0.55,
            "feature_columns": DEFAULT_FEATURE_COLUMNS,
            "model_version": DEFAULT_MODEL_VERSION,
            "schema_version": SCHEMA_VERSION,
        }

    with metadata_path.open("r", encoding="utf-8") as file:
        metadata = json.load(file)

    threshold = float(metadata.get("threshold", 0.55))
    feature_columns = metadata.get("feature_columns", DEFAULT_FEATURE_COLUMNS)
    model_version = metadata.get("model_version", DEFAULT_MODEL_VERSION)
    schema_version = metadata.get("schema_version", SCHEMA_VERSION)
    return {
        "threshold": threshold,
        "feature_columns": feature_columns,
        "model_version": model_version,
        "schema_version": schema_version,
    }


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


def _segment_code(segment: str) -> int:
    normalized = segment.strip().lower()
    return SEGMENT_MAP.get(normalized, SEGMENT_MAP["unknown"])


def _build_payload_row(payload: PredictRequest) -> dict[str, Any]:
    row: dict[str, Any] = {
        "segment": payload.segment,
        "segment_code": _segment_code(payload.segment),
        "monthly_inflow": payload.monthly_inflow,
        "monthly_outflow": payload.monthly_outflow,
        "inflow_volatility_90d": payload.inflow_volatility_90d,
        "outflow_volatility_90d": payload.outflow_volatility_90d,
        "deposit_count_30d": payload.deposit_count_30d,
        "days_since_last_income": payload.days_since_last_income,
        "avg_balance_30d": payload.avg_balance_30d,
        "min_balance_30d": payload.min_balance_30d,
        "negative_balance_days_30d": payload.negative_balance_days_30d,
        "essential_spend_ratio": payload.essential_spend_ratio,
        "active_loan_count": payload.active_loan_count,
        "monthly_installment_burden": payload.monthly_installment_burden,
        "purchase_amount": payload.purchase_amount,
        "tenure_weeks": payload.tenure_weeks,
        "purchase_to_inflow_ratio": payload.purchase_to_inflow_ratio,
        "installment_to_inflow_ratio": payload.installment_to_inflow_ratio,
        "total_burden_ratio": payload.total_burden_ratio,
        "buffer_ratio": payload.buffer_ratio,
        "stress_index": payload.stress_index,
    }

    for legacy_feature, v2_feature in LEGACY_ALIAS_COLUMNS.items():
        row[legacy_feature] = row[v2_feature]

    return row


def _clamp(value: float, min_value: float = 0.0, max_value: float = 1.0) -> float:
    return max(min_value, min(max_value, value))


def _calibration_bucket(risk_probability: float) -> str:
    probability = _clamp(float(risk_probability))
    if probability < 0.2:
        return "very_low"
    if probability < 0.4:
        return "low"
    if probability < 0.6:
        return "medium"
    if probability < 0.8:
        return "high"
    return "very_high"


def _derive_reasons(payload: dict[str, Any]) -> list[ScoreReason]:
    monthly_inflow = max(float(payload.get("monthly_inflow", 1.0)), 1.0)
    monthly_outflow = float(payload.get("monthly_outflow", 0.0))
    burden = _clamp(float(payload.get("total_burden_ratio", 0.0)))
    stress = _clamp(float(payload.get("stress_index", 0.0)))
    buffer_ratio = max(float(payload.get("buffer_ratio", 0.0)), 0.0)
    negative_days = float(payload.get("negative_balance_days_30d", 0.0))
    deposit_count = float(payload.get("deposit_count_30d", 0.0))
    inflow_vol = _clamp(float(payload.get("inflow_volatility_90d", 0.0)))
    cashflow_load = _clamp(monthly_outflow / monthly_inflow)

    effects: list[tuple[str, str, float, str]] = [
        (
            "HIGH_TOTAL_BURDEN",
            "total_burden_ratio",
            burden * 0.42,
            "High total burden ratio indicates elevated repayment pressure.",
        ),
        (
            "HIGH_STRESS_INDEX",
            "stress_index",
            stress * 0.34,
            "Stress index suggests unstable cash-flow resilience.",
        ),
        (
            "NEGATIVE_BALANCE_FREQUENCY",
            "negative_balance_days_30d",
            _clamp(negative_days / 30.0) * 0.24,
            "Recent negative-balance days increase short-term default risk.",
        ),
        (
            "INFLOW_VOLATILITY_PRESSURE",
            "inflow_volatility_90d",
            inflow_vol * 0.18,
            "Income volatility creates repayment uncertainty.",
        ),
        (
            "CASHFLOW_LOAD",
            "monthly_outflow",
            _clamp(cashflow_load) * 0.12,
            "High outflow relative to inflow reduces repayment buffer.",
        ),
        (
            "BUFFER_STRENGTH",
            "buffer_ratio",
            -_clamp(buffer_ratio / 1.5) * 0.2,
            "Healthy liquidity buffer lowers near-term repayment risk.",
        ),
        (
            "INCOME_REGULARITY",
            "deposit_count_30d",
            -_clamp(deposit_count / 12.0) * 0.08,
            "Frequent income deposits improve repayment confidence.",
        ),
    ]

    ranked = sorted(effects, key=lambda item: abs(item[2]), reverse=True)[:4]
    reasons: list[ScoreReason] = []
    for code, feature, impact, message in ranked:
        reasons.append(
            ScoreReason(
                code=code,
                feature=feature,
                direction="up" if impact >= 0 else "down",
                impact=round(abs(float(impact)), 6),
                message=message,
            )
        )
    return reasons


def _normalize_reasons(value: Any) -> list[ScoreReason]:
    if not isinstance(value, list):
        return []

    normalized: list[ScoreReason] = []
    for entry in value:
        if not isinstance(entry, dict):
            continue
        code = str(entry.get("code", "")).strip()
        feature = str(entry.get("feature", "")).strip()
        direction = str(entry.get("direction", "up")).strip().lower()
        message = str(entry.get("message", "")).strip()
        impact_raw = entry.get("impact")
        try:
            impact = abs(float(impact_raw))
        except Exception:
            impact = 0.0
        if not code or not feature:
            continue
        normalized.append(
            ScoreReason(
                code=code,
                feature=feature,
                direction="down" if direction == "down" else "up",
                impact=round(impact, 6),
                message=message or f"{feature} contributed to the model decision.",
            )
        )
    return normalized


def _request_ml_service(
    url: str,
    timeout: float,
    payload: dict[str, Any],
    *,
    threshold: float,
) -> ScoreResult | float | None:
    try:
        response = httpx.post(f"{url}/predict", json=payload, timeout=timeout)
        response.raise_for_status()
        data = response.json()
        value = data.get("risk_probability")
        if value is None:
            raise ValueError("ML service response missing risk_probability")

        risk_probability = float(value)
        decision = data.get("decision")
        if decision not in {"Approve", "Decline"}:
            decision = "Decline" if risk_probability >= threshold else "Approve"

        model_version = str(data.get("model_version") or DEFAULT_MODEL_VERSION)
        schema_version = str(data.get("schema_version") or SCHEMA_VERSION)
        calibration_bucket = str(data.get("calibration_bucket") or _calibration_bucket(risk_probability))
        reasons = _normalize_reasons(data.get("reasons"))
        if not reasons:
            reasons = _derive_reasons(payload)

        return ScoreResult(
            risk_probability=risk_probability,
            source="ml_service",
            model_version=model_version,
            schema_version=schema_version,
            calibration_bucket=calibration_bucket,
            reasons=reasons,
        )
    except Exception:
        return None
