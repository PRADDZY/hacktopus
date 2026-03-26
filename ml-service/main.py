import json
import os
import threading
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal, cast
from urllib import error as urllib_error
from urllib import request as urllib_request

import joblib
import pandas as pd
import xgboost as xgb
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
    from catboost import CatBoostClassifier
except Exception:  # pragma: no cover - optional dependency in legacy mode
    CatBoostClassifier = None  # type: ignore[assignment]

PROJECT_ROOT = Path(__file__).resolve().parent
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
DEFAULT_REASON_CODE_CATALOG = [
    "HIGH_TOTAL_BURDEN",
    "HIGH_STRESS_INDEX",
    "NEGATIVE_BALANCE_FREQUENCY",
    "INFLOW_VOLATILITY_PRESSURE",
    "CASHFLOW_LOAD",
    "BUFFER_STRENGTH",
    "INCOME_REGULARITY",
]
DEFAULT_JSON_MODEL_NAME = "gig_bnpl_xgb_model.json"
DEFAULT_RUNTIME_MODE = "auto"
STATEMENT_FEATURE_SCHEMA_VERSION = "statement-feature-v1"
PRIMARY_TARGET_COLUMN = "default_90d_proxy"
SECONDARY_TARGET_COLUMN = "affordability_stress_proxy"
RuntimeMode = Literal["auto", "dual_target", "ensemble", "single_model"]


class PredictRequest(BaseModel):
    segment: str = Field(..., description="Applicant segment")
    monthly_inflow: float = Field(..., gt=0, description="Average monthly inflow")
    monthly_outflow: float = Field(..., ge=0, description="Average monthly outflow")
    inflow_volatility_90d: float = Field(..., ge=0, description="90-day inflow volatility")
    outflow_volatility_90d: float = Field(..., ge=0, description="90-day outflow volatility")
    deposit_count_30d: int = Field(..., ge=0, description="Deposit count in last 30 days")
    days_since_last_income: int = Field(..., ge=0, description="Days since last income credit")
    avg_balance_30d: float = Field(..., description="Average balance in last 30 days")
    min_balance_30d: float = Field(..., description="Minimum balance in last 30 days")
    negative_balance_days_30d: int = Field(..., ge=0, description="Negative balance days in last 30 days")
    essential_spend_ratio: float = Field(..., ge=0, description="Essential spend ratio")
    active_loan_count: int = Field(..., ge=0, description="Active loan count")
    monthly_installment_burden: float = Field(..., ge=0, description="Monthly installment burden")
    purchase_amount: float = Field(..., ge=0, description="Purchase amount under evaluation")
    tenure_weeks: int = Field(..., ge=1, description="Requested tenure in weeks")
    purchase_to_inflow_ratio: float = Field(..., ge=0, description="Purchase to inflow ratio")
    installment_to_inflow_ratio: float = Field(..., ge=0, description="Installment to inflow ratio")
    total_burden_ratio: float = Field(..., ge=0, description="Total burden ratio")
    buffer_ratio: float = Field(..., ge=0, description="Buffer ratio")
    stress_index: float = Field(..., ge=0, description="Stress index")


class StatementTransaction(BaseModel):
    date: str = Field(..., description="Transaction booking date in ISO format")
    amount: float = Field(..., description="Signed transaction amount")
    direction: str | None = Field(default=None, description="credit/debit classification")
    type: str | None = Field(default=None, description="Alias for direction")
    balance: float | None = Field(default=None, description="Running account balance after transaction")
    description: str | None = Field(default=None, description="Free-form statement description")
    category: str | None = Field(default=None, description="Optional pre-labeled transaction category")


class StatementFeatureizeRequest(BaseModel):
    segment: str = Field(default="unknown", description="Applicant segment")
    purchase_amount: float | None = Field(default=None, ge=0, description="Optional requested purchase amount")
    tenure_weeks: int | None = Field(default=None, ge=1, description="Optional requested tenure in weeks")
    statement_window_days: int = Field(default=90, ge=30, le=180, description="Lookback window for feature extraction")
    transactions: list[StatementTransaction] = Field(
        ..., min_length=1, description="Bank statement transactions over the lookback period"
    )


class PredictionReason(BaseModel):
    code: str
    feature: str
    direction: Literal["up", "down"]
    impact: float
    message: str


class PredictResponse(BaseModel):
    risk_probability: float
    decision: Literal["Approve", "Decline"]
    model_source: str
    model_version: str
    schema_version: str
    calibration_bucket: str
    reasons: list[PredictionReason]


class MetadataResponse(BaseModel):
    threshold: float
    schema_version: str
    model_version: str
    required_features: list[str]
    reason_code_catalog: list[str]


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: str


class StatementFeatureizeResponse(BaseModel):
    schema_version: str
    feature_schema_version: str
    features: PredictRequest


class ExtractionDispatchRequest(BaseModel):
    extraction_job_id: str = Field(..., min_length=1, description="Worker extraction job identifier")
    document_id: str = Field(..., min_length=1, description="Document identifier")
    owner_sub: str = Field(..., min_length=1, description="Owner subject identifier")
    storage_key: str = Field(..., min_length=1, description="Storage key for the source statement")
    source: str | None = Field(default="upload", description="Document source label")


class ExtractionDispatchResponse(BaseModel):
    job_id: str
    accepted: bool


def _resolve_model_paths() -> tuple[Path, Path]:
    env_model_path = os.getenv("MODEL_PATH")
    env_metadata_path = os.getenv("MODEL_METADATA_PATH")

    local_model_path = PROJECT_ROOT / "bnpl_cashflow_model.pkl"
    local_metadata_path = PROJECT_ROOT / "model_metadata.json"

    model_path = Path(env_model_path) if env_model_path else local_model_path
    metadata_path = Path(env_metadata_path) if env_metadata_path else local_metadata_path

    return model_path, metadata_path


def _is_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _is_legacy_json_fallback_enabled() -> bool:
    return _is_truthy(os.getenv("ML_LEGACY_JSON_FALLBACK_ENABLED"))


def _resolve_runtime_mode(value: str | None) -> RuntimeMode:
    if value is None:
        return "auto"

    normalized = value.strip().lower()
    if normalized in {"auto", "dual_target", "ensemble", "single_model"}:
        return cast(RuntimeMode, normalized)

    raise RuntimeError(
        "Invalid MODEL_RUNTIME_MODE. Supported values: auto, dual_target, ensemble, single_model."
    )


def _load_metadata(metadata_path: Path) -> dict[str, Any]:
    if not metadata_path.exists():
        return {
            "threshold": 0.55,
            "feature_columns": DEFAULT_FEATURE_COLUMNS,
            "required_features": DEFAULT_FEATURE_COLUMNS,
            "model_version": DEFAULT_MODEL_VERSION,
            "schema_version": SCHEMA_VERSION,
            "reason_code_catalog": DEFAULT_REASON_CODE_CATALOG,
        }

    with metadata_path.open("r", encoding="utf-8") as file:
        metadata = json.load(file)

    threshold = float(metadata.get("threshold", 0.55))
    feature_columns = metadata.get("feature_columns", DEFAULT_FEATURE_COLUMNS)
    required_features = metadata.get("required_features", DEFAULT_FEATURE_COLUMNS)
    model_version = metadata.get("model_version", DEFAULT_MODEL_VERSION)
    schema_version = metadata.get("schema_version", SCHEMA_VERSION)
    reason_code_catalog = metadata.get("reason_code_catalog", DEFAULT_REASON_CODE_CATALOG)
    return {
        "threshold": threshold,
        "feature_columns": feature_columns,
        "required_features": required_features,
        "model_version": model_version,
        "schema_version": schema_version,
        "reason_code_catalog": reason_code_catalog,
    }


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


def _predict_with_calibration(model: Any, calibrator: Any, row: pd.DataFrame) -> float:
    raw_probability = _predict_risk_probability(model, row)
    if calibrator is None:
        return float(raw_probability)
    if hasattr(calibrator, "predict"):
        calibrated = calibrator.predict([raw_probability])
        return float(calibrated[0])
    return float(raw_probability)


def _load_dual_target_bundle(metadata: dict[str, Any]) -> dict[str, Any] | None:
    dual_target = metadata.get("dual_target")
    if not isinstance(dual_target, dict):
        return None

    artifacts_dir_raw = os.getenv("MODEL_ARTIFACT_DIR")
    if not artifacts_dir_raw:
        return None

    artifacts_dir = Path(artifacts_dir_raw)
    if not artifacts_dir.exists():
        return None

    artifacts = dual_target.get("artifacts")
    if not isinstance(artifacts, dict):
        return None

    primary_model_path = artifacts_dir / str(artifacts.get("primary_model", "default_model.pkl"))
    secondary_model_path = artifacts_dir / str(artifacts.get("secondary_model", "stress_model.pkl"))
    primary_calibrator_path = artifacts_dir / str(
        artifacts.get("primary_calibrator", "default_calibrator.pkl")
    )
    secondary_calibrator_path = artifacts_dir / str(
        artifacts.get("secondary_calibrator", "stress_calibrator.pkl")
    )

    if not primary_model_path.exists() or not secondary_model_path.exists():
        return None

    primary_model = joblib.load(primary_model_path)
    secondary_model = joblib.load(secondary_model_path)
    primary_calibrator = joblib.load(primary_calibrator_path) if primary_calibrator_path.exists() else None
    secondary_calibrator = (
        joblib.load(secondary_calibrator_path) if secondary_calibrator_path.exists() else None
    )

    blend_weights = dual_target.get("blend_weights", {}) if isinstance(dual_target.get("blend_weights"), dict) else {}
    weight_primary = float(blend_weights.get(PRIMARY_TARGET_COLUMN, 0.7))
    weight_secondary = float(blend_weights.get(SECONDARY_TARGET_COLUMN, 0.3))
    weight_sum = max(weight_primary + weight_secondary, 1e-6)
    weight_primary = weight_primary / weight_sum
    weight_secondary = weight_secondary / weight_sum

    return {
        "primary_model": primary_model,
        "secondary_model": secondary_model,
        "primary_calibrator": primary_calibrator,
        "secondary_calibrator": secondary_calibrator,
        "weight_primary": weight_primary,
        "weight_secondary": weight_secondary,
    }


def _load_ensemble_bundle(metadata: dict[str, Any]) -> dict[str, Any] | None:
    artifacts_dir_raw = os.getenv("MODEL_ARTIFACT_DIR")
    if not artifacts_dir_raw:
        return None

    artifacts_dir = Path(artifacts_dir_raw)
    if not artifacts_dir.exists():
        return None

    cat_model_path = artifacts_dir / "catboost_model.cbm"
    ft_model_path = artifacts_dir / "ft_model.pkl"
    if not cat_model_path.exists() or not ft_model_path.exists():
        return None

    if CatBoostClassifier is None:
        return None

    cat_model = CatBoostClassifier()
    cat_model.load_model(str(cat_model_path))
    ft_model = joblib.load(ft_model_path)

    cat_calibrator_path = artifacts_dir / "cat_calibrator.pkl"
    ft_calibrator_path = artifacts_dir / "ft_calibrator.pkl"
    cat_calibrator = joblib.load(cat_calibrator_path) if cat_calibrator_path.exists() else None
    ft_calibrator = joblib.load(ft_calibrator_path) if ft_calibrator_path.exists() else None

    ensemble = metadata.get("ensemble", {}) if isinstance(metadata.get("ensemble"), dict) else {}
    weight_cat = float(ensemble.get("weight_catboost", 0.65))
    weight_ft = float(ensemble.get("weight_ft", max(0.0, 1.0 - weight_cat)))
    weight_sum = max(weight_cat + weight_ft, 1e-6)
    weight_cat = weight_cat / weight_sum
    weight_ft = weight_ft / weight_sum

    return {
        "cat_model": cat_model,
        "ft_model": ft_model,
        "cat_calibrator": cat_calibrator,
        "ft_calibrator": ft_calibrator,
        "weight_cat": weight_cat,
        "weight_ft": weight_ft,
    }


def _predict_dual_target_probability(bundle: dict[str, Any], row: pd.DataFrame) -> float:
    primary_probability = _predict_with_calibration(
        bundle["primary_model"],
        bundle["primary_calibrator"],
        row,
    )
    secondary_probability = _predict_with_calibration(
        bundle["secondary_model"],
        bundle["secondary_calibrator"],
        row,
    )
    blended = bundle["weight_primary"] * primary_probability + bundle["weight_secondary"] * secondary_probability
    return float(_clamp(blended))


def _predict_ensemble_probability(bundle: dict[str, Any], row: pd.DataFrame) -> float:
    cat_probability = _predict_with_calibration(bundle["cat_model"], bundle["cat_calibrator"], row)
    ft_probability = _predict_with_calibration(bundle["ft_model"], bundle["ft_calibrator"], row)
    blended = bundle["weight_cat"] * cat_probability + bundle["weight_ft"] * ft_probability
    return float(_clamp(blended))


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


def _normalize_statement_direction(direction: str | None, amount: float) -> Literal["credit", "debit"]:
    if direction:
        normalized = direction.strip().lower()
        if normalized in {"credit", "cr", "inflow", "income", "deposit"}:
            return "credit"
        if normalized in {"debit", "dr", "outflow", "expense", "withdrawal", "payment"}:
            return "debit"
    return "credit" if amount >= 0 else "debit"


def _safe_float(value: Any, fallback: float) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return fallback
    return fallback


def _bounded(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, float(value)))


def _monthly_volatility(dataframe: pd.DataFrame) -> float:
    if dataframe.empty:
        return 0.18

    date_series = dataframe["tx_date"]
    if getattr(date_series.dt, "tz", None) is not None:
        date_series = date_series.dt.tz_convert(None)

    monthly = dataframe.groupby(date_series.dt.to_period("M"))["amount"].sum()
    if monthly.empty:
        return 0.18

    mean = float(monthly.mean())
    if len(monthly) <= 1 or mean <= 1e-6:
        return 0.15

    std = float(monthly.std(ddof=0))
    return _bounded(std / max(mean, 1e-6), 0.01, 1.2)


def _extract_statement_features(payload: StatementFeatureizeRequest) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    for transaction in payload.transactions:
        parsed_date = pd.to_datetime(transaction.date, errors="coerce", utc=True)
        if pd.isna(parsed_date):
            continue
        direction = _normalize_statement_direction(
            transaction.direction or transaction.type,
            float(transaction.amount),
        )
        rows.append(
            {
                "tx_date": parsed_date,
                "direction": direction,
                "amount": abs(float(transaction.amount)),
                "balance": transaction.balance,
                "description": (transaction.description or "").strip().lower(),
                "category": (transaction.category or "").strip().lower(),
            }
        )

    if not rows:
        raise ValueError("No valid transactions with parseable dates were provided.")

    frame = pd.DataFrame(rows)
    reference_date = frame["tx_date"].max().floor("D")
    if pd.isna(reference_date):
        reference_date = pd.Timestamp(datetime.now(UTC).date())

    window_days = int(_bounded(payload.statement_window_days, 30, 180))
    window_start = reference_date - pd.Timedelta(days=window_days - 1)
    window_frame = frame[frame["tx_date"] >= window_start]
    if window_frame.empty:
        window_frame = frame

    window_months = max(window_days / 30.0, 1.0)
    credit_frame = window_frame[window_frame["direction"] == "credit"]
    debit_frame = window_frame[window_frame["direction"] == "debit"]

    monthly_inflow = max(float(credit_frame["amount"].sum()) / window_months, 1.0)
    monthly_outflow = max(float(debit_frame["amount"].sum()) / window_months, 0.0)

    inflow_volatility = _monthly_volatility(credit_frame)
    outflow_volatility = _monthly_volatility(debit_frame)

    recent_start = reference_date - pd.Timedelta(days=29)
    recent_frame = frame[frame["tx_date"] >= recent_start]
    recent_credit_frame = recent_frame[recent_frame["direction"] == "credit"]
    deposit_count_30d = int(len(recent_credit_frame))

    if credit_frame.empty:
        days_since_last_income = window_days
    else:
        last_income_date = credit_frame["tx_date"].max()
        days_since_last_income = int(max((reference_date - last_income_date).days, 0))

    balance_series = recent_frame["balance"].dropna()
    if balance_series.empty:
        avg_balance_30d = max(monthly_inflow - monthly_outflow, 0.0)
        min_balance_30d = max(avg_balance_30d * 0.35, 0.0)
        negative_balance_days_30d = 0
    else:
        avg_balance_30d = float(balance_series.mean())
        min_balance_30d = float(balance_series.min())
        negative_balance_days_30d = int(recent_frame.loc[recent_frame["balance"] < 0, "tx_date"].dt.date.nunique())

    essential_keywords = (
        "rent",
        "grocery",
        "food",
        "utility",
        "electricity",
        "transport",
        "education",
        "medical",
        "insurance",
    )
    loan_keywords = ("loan", "emi", "installment", "bnpl", "paylater", "credit card bill", "repayment")

    if debit_frame.empty:
        essential_spend_ratio = 0.2
        monthly_installment_burden = 0.0
        active_loan_count = 0
    else:
        essential_mask = debit_frame["category"].str.contains("|".join(essential_keywords), na=False) | debit_frame[
            "description"
        ].str.contains("|".join(essential_keywords), na=False)
        essential_amount = float(debit_frame.loc[essential_mask, "amount"].sum())
        total_debit_amount = max(float(debit_frame["amount"].sum()), 1.0)
        if essential_amount <= 0:
            essential_amount = total_debit_amount * 0.62
        essential_spend_ratio = _bounded(essential_amount / total_debit_amount, 0.1, 1.0)

        loan_mask = debit_frame["category"].str.contains("|".join(loan_keywords), na=False) | debit_frame[
            "description"
        ].str.contains("|".join(loan_keywords), na=False)
        loan_amount = float(debit_frame.loc[loan_mask, "amount"].sum())
        monthly_installment_burden = loan_amount / window_months
        if monthly_installment_burden <= 0:
            monthly_installment_burden = monthly_outflow * 0.18

        loan_count_estimate = int(max(round(float(loan_mask.sum()) / window_months), 0))
        if loan_count_estimate == 0 and monthly_installment_burden >= monthly_inflow * 0.08:
            loan_count_estimate = 1
        active_loan_count = loan_count_estimate

    purchase_amount = (
        float(payload.purchase_amount)
        if payload.purchase_amount is not None
        else max(monthly_inflow * 0.22, 500.0)
    )
    tenure_weeks = int(payload.tenure_weeks or 24)

    purchase_to_inflow_ratio = purchase_amount / monthly_inflow
    installment_to_inflow_ratio = monthly_installment_burden / monthly_inflow
    total_burden_ratio = max((monthly_outflow + monthly_installment_burden) / monthly_inflow, 0.0)
    buffer_ratio = max(min_balance_30d / monthly_inflow, 0.0)
    stress_index = _bounded(
        inflow_volatility * 0.38 + outflow_volatility * 0.17 + min(total_burden_ratio, 1.25) * 0.45,
        0.0,
        1.5,
    )

    segment = payload.segment.strip().lower() or "unknown"
    if segment not in SEGMENT_MAP:
        segment = "unknown"

    return {
        "segment": segment,
        "monthly_inflow": round(monthly_inflow, 6),
        "monthly_outflow": round(monthly_outflow, 6),
        "inflow_volatility_90d": round(inflow_volatility, 6),
        "outflow_volatility_90d": round(outflow_volatility, 6),
        "deposit_count_30d": max(deposit_count_30d, 0),
        "days_since_last_income": max(days_since_last_income, 0),
        "avg_balance_30d": round(_safe_float(avg_balance_30d, 0.0), 6),
        "min_balance_30d": round(_safe_float(min_balance_30d, 0.0), 6),
        "negative_balance_days_30d": max(negative_balance_days_30d, 0),
        "essential_spend_ratio": round(essential_spend_ratio, 6),
        "active_loan_count": max(active_loan_count, 0),
        "monthly_installment_burden": round(max(monthly_installment_burden, 0.0), 6),
        "purchase_amount": round(max(purchase_amount, 0.0), 6),
        "tenure_weeks": max(tenure_weeks, 1),
        "purchase_to_inflow_ratio": round(max(purchase_to_inflow_ratio, 0.0), 6),
        "installment_to_inflow_ratio": round(max(installment_to_inflow_ratio, 0.0), 6),
        "total_burden_ratio": round(max(total_burden_ratio, 0.0), 6),
        "buffer_ratio": round(max(buffer_ratio, 0.0), 6),
        "stress_index": round(max(stress_index, 0.0), 6),
    }


def _read_callback_base_url() -> str | None:
    value = os.getenv("EXTRACTION_CALLBACK_BASE_URL")
    if not value:
        return None
    normalized = value.strip()
    return normalized.rstrip("/") if normalized else None


def _read_callback_secret() -> str | None:
    value = os.getenv("EXTRACTION_CALLBACK_SECRET")
    if not value:
        return None
    normalized = value.strip()
    return normalized or None


def _post_extraction_callback(
    *,
    extraction_job_id: str,
    external_job_id: str,
    status: Literal["processing", "completed", "failed"],
    error_message: str | None = None,
    features: dict[str, Any] | None = None,
) -> None:
    callback_base_url = _read_callback_base_url()
    callback_secret = _read_callback_secret()
    if not callback_base_url or not callback_secret:
        return

    payload: dict[str, Any] = {
        "status": status,
        "external_job_id": external_job_id,
    }
    if error_message:
        payload["error_message"] = error_message
    if features is not None:
        payload["features"] = features

    callback_url = f"{callback_base_url}/v1/extraction-jobs/{extraction_job_id}/callback"
    request = urllib_request.Request(
        callback_url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Callback-Secret": callback_secret,
        },
    )
    timeout = max(float(os.getenv("EXTRACTION_CALLBACK_TIMEOUT_SECONDS", "8")), 1.0)

    try:
        with urllib_request.urlopen(request, timeout=timeout) as response:  # noqa: S310
            response.read()
    except (urllib_error.HTTPError, urllib_error.URLError, TimeoutError, ValueError):
        return


def _run_extraction_pipeline(payload: ExtractionDispatchRequest, *, external_job_id: str) -> None:
    _post_extraction_callback(
        extraction_job_id=payload.extraction_job_id,
        external_job_id=external_job_id,
        status="processing",
    )
    _post_extraction_callback(
        extraction_job_id=payload.extraction_job_id,
        external_job_id=external_job_id,
        status="failed",
        error_message=(
            "Extraction backend acknowledged the job but no OCR parser is configured in this deployment. "
            "Upload CSV statements for direct scoring."
        ),
    )


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


def _derive_reasons(payload: dict[str, Any]) -> list[PredictionReason]:
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
    reasons: list[PredictionReason] = []
    for code, feature, impact, message in ranked:
        reasons.append(
            PredictionReason(
                code=code,
                feature=feature,
                direction="up" if impact >= 0 else "down",
                impact=round(abs(float(impact)), 6),
                message=message,
            )
        )
    return reasons


@asynccontextmanager
async def lifespan(app: FastAPI):
    model_path, metadata_path = _resolve_model_paths()
    metadata = _load_metadata(metadata_path)
    runtime_mode = _resolve_runtime_mode(os.getenv("MODEL_RUNTIME_MODE"))
    dual_target_bundle = _load_dual_target_bundle(metadata)
    ensemble_bundle = _load_ensemble_bundle(metadata)

    model_source = "pkl"
    model = None
    if runtime_mode == "dual_target":
        if dual_target_bundle is None:
            raise RuntimeError(
                "MODEL_RUNTIME_MODE=dual_target requires promoted dual-target artifacts "
                "(MODEL_ARTIFACT_DIR + dual_target metadata)."
            )
        model_source = "dual_target"
    elif runtime_mode == "ensemble":
        if ensemble_bundle is None:
            raise RuntimeError(
                "MODEL_RUNTIME_MODE=ensemble requires CatBoost+FT ensemble artifacts in MODEL_ARTIFACT_DIR."
            )
        model_source = "ensemble"
    elif runtime_mode == "single_model":
        if not model_path.exists():
            raise RuntimeError(
                f"MODEL_RUNTIME_MODE=single_model requires MODEL_PATH artifact, but file was not found: {model_path}."
            )
        model = joblib.load(model_path)
        model_source = "pkl"
    else:
        if dual_target_bundle:
            model_source = "dual_target"
        elif ensemble_bundle:
            model_source = "ensemble"
        elif model_path.exists():
            model = joblib.load(model_path)
            model_source = "pkl"
        elif _is_legacy_json_fallback_enabled():
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
            model_source = "json_legacy"
        else:
            raise RuntimeError(
                f"Model file not found at {model_path}. Legacy JSON fallback is disabled. "
                "Provide MODEL_PATH or set MODEL_ARTIFACT_DIR with promoted artifacts."
            )

    app.state.model = model
    app.state.dual_target_bundle = dual_target_bundle
    app.state.ensemble_bundle = ensemble_bundle
    app.state.model_source = model_source
    app.state.runtime_mode = runtime_mode
    app.state.threshold = float(metadata["threshold"])
    app.state.model_feature_columns = list(metadata["feature_columns"])
    app.state.required_features = list(metadata["required_features"])
    app.state.model_version = str(metadata["model_version"])
    app.state.schema_version = str(metadata["schema_version"])
    app.state.reason_code_catalog = list(metadata["reason_code_catalog"])

    yield


app = FastAPI(
    title="FairLens ML Service",
    description="Model inference service for FairLens BNPL risk scoring.",
    version="2.0.0",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        model_loaded=True,
        model_version=app.state.model_version,
    )


@app.get("/metadata", response_model=MetadataResponse)
def metadata() -> MetadataResponse:
    return MetadataResponse(
        threshold=app.state.threshold,
        schema_version=app.state.schema_version,
        model_version=app.state.model_version,
        required_features=app.state.required_features,
        reason_code_catalog=app.state.reason_code_catalog,
    )


@app.post("/featureize/statement", response_model=StatementFeatureizeResponse)
def featureize_statement(payload: StatementFeatureizeRequest) -> StatementFeatureizeResponse:
    try:
        features = PredictRequest(**_extract_statement_features(payload))
        return StatementFeatureizeResponse(
            schema_version=app.state.schema_version,
            feature_schema_version=STATEMENT_FEATURE_SCHEMA_VERSION,
            features=features,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid statement payload: {exc}") from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Statement feature extraction failed: {exc}") from exc


@app.post("/extract", response_model=ExtractionDispatchResponse)
def extract(payload: ExtractionDispatchRequest) -> ExtractionDispatchResponse:
    extraction_job_id = payload.extraction_job_id.strip()
    if not extraction_job_id:
        raise HTTPException(status_code=422, detail="extraction_job_id is required")

    external_job_id = f"modal-{uuid.uuid4().hex[:12]}"
    worker = threading.Thread(
        target=_run_extraction_pipeline,
        args=(payload,),
        kwargs={"external_job_id": external_job_id},
        daemon=True,
    )
    worker.start()

    return ExtractionDispatchResponse(job_id=external_job_id, accepted=True)


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    try:
        input_row = pd.DataFrame([_build_payload_row(payload)])

        feature_columns = app.state.model_feature_columns
        missing_columns = [column for column in feature_columns if column not in input_row.columns]
        if missing_columns:
            raise HTTPException(status_code=500, detail=f"Missing feature columns: {missing_columns}")

        ordered_row = input_row[feature_columns]
        if app.state.dual_target_bundle is not None:
            risk_probability = _predict_dual_target_probability(app.state.dual_target_bundle, ordered_row)
        elif app.state.ensemble_bundle is not None:
            risk_probability = _predict_ensemble_probability(app.state.ensemble_bundle, ordered_row)
        elif app.state.model is not None:
            risk_probability = _predict_risk_probability(app.state.model, ordered_row)
        else:
            raise RuntimeError("No model loaded for prediction.")
        decision = "Decline" if float(risk_probability) >= float(app.state.threshold) else "Approve"

        return PredictResponse(
            risk_probability=round(float(risk_probability), 6),
            decision=decision,
            model_source=app.state.model_source,
            model_version=app.state.model_version,
            schema_version=app.state.schema_version,
            calibration_bucket=_calibration_bucket(float(risk_probability)),
            reasons=_derive_reasons(input_row.iloc[0].to_dict()),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc
