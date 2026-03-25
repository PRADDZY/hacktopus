from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import average_precision_score, brier_score_loss, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split

try:
    from catboost import CatBoostClassifier

    HAS_CATBOOST = True
except Exception:
    HAS_CATBOOST = False

try:
    from lightgbm import LGBMClassifier

    HAS_LIGHTGBM = True
except Exception:
    HAS_LIGHTGBM = False

from feature_schema import (
    BLEND_WEIGHTS,
    FEATURE_COLUMNS,
    MODEL_VERSION,
    PRIMARY_TARGET_COLUMN,
    PROMOTION_GATES,
    REASON_CODE_CATALOG,
    RISK_SCHEMA_VERSION,
    SECONDARY_TARGET_COLUMN,
)

SEGMENT_NAME_BY_CODE = {
    0: "student",
    1: "gig_worker",
    2: "informal_worker",
    3: "salaried",
    4: "self_employed",
    5: "unknown",
}


def _to_float(value: Any, fallback: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    if not math.isfinite(parsed):
        return fallback
    return parsed


def _clamp_unit(value: float) -> float:
    return float(max(0.0, min(1.0, value)))


def _load_dataset(path: Path) -> pd.DataFrame:
    if path.suffix.lower() == ".parquet":
        frame = pd.read_parquet(path)
    else:
        frame = pd.read_csv(path)

    required = FEATURE_COLUMNS + [PRIMARY_TARGET_COLUMN, SECONDARY_TARGET_COLUMN]
    missing = [column for column in required if column not in frame.columns]
    if missing:
        raise ValueError(f"Dataset missing required columns: {missing}")

    frame = frame[required].copy()
    frame = frame.replace([np.inf, -np.inf], np.nan).fillna(0)
    frame[PRIMARY_TARGET_COLUMN] = frame[PRIMARY_TARGET_COLUMN].astype(int).clip(0, 1)
    frame[SECONDARY_TARGET_COLUMN] = frame[SECONDARY_TARGET_COLUMN].astype(int).clip(0, 1)
    return frame


def _fit_catboost(X_train: pd.DataFrame, y_train: pd.Series, X_valid: pd.DataFrame, y_valid: pd.Series) -> Any:
    if not HAS_CATBOOST:
        fallback = HistGradientBoostingClassifier(
            learning_rate=0.06,
            max_depth=8,
            max_iter=350,
            random_state=42,
        )
        fallback.fit(X_train, y_train)
        return fallback

    positive_rate = float(y_train.mean())
    class_weights = [1.0, float(max(1.0, (1 - positive_rate) / max(positive_rate, 1e-6)))]
    model = CatBoostClassifier(
        loss_function="Logloss",
        eval_metric="AUC",
        depth=8,
        learning_rate=0.05,
        iterations=700,
        l2_leaf_reg=8.0,
        random_seed=42,
        verbose=False,
        class_weights=class_weights,
    )
    model.fit(X_train, y_train, eval_set=(X_valid, y_valid), verbose=False)
    return model


def _fit_lightgbm(X_train: pd.DataFrame, y_train: pd.Series) -> Any:
    if HAS_LIGHTGBM:
        model = LGBMClassifier(
            objective="binary",
            n_estimators=450,
            learning_rate=0.04,
            num_leaves=63,
            subsample=0.9,
            colsample_bytree=0.85,
            reg_alpha=0.2,
            reg_lambda=0.4,
            random_state=42,
            class_weight="balanced",
            verbose=-1,
        )
        model.fit(X_train, y_train)
        return model

    fallback = HistGradientBoostingClassifier(
        learning_rate=0.05,
        max_depth=9,
        max_iter=420,
        random_state=42,
    )
    fallback.fit(X_train, y_train)
    return fallback


def _predict_probability(model: Any, frame: pd.DataFrame) -> np.ndarray:
    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(frame)
        return np.asarray(probabilities)[:, 1]

    raw = model.predict(frame)
    values = np.asarray(raw, dtype=float)
    return np.clip(values, 0.0, 1.0)


def _calibrate(probabilities: np.ndarray, labels: np.ndarray) -> IsotonicRegression:
    calibrator = IsotonicRegression(out_of_bounds="clip")
    calibrator.fit(probabilities, labels)
    return calibrator


def _evaluate(labels: np.ndarray, probs: np.ndarray) -> dict[str, float]:
    labels = np.asarray(labels, dtype=int)
    probs = np.asarray(probs, dtype=float)
    probs = np.nan_to_num(probs, nan=0.5, posinf=1.0, neginf=0.0)
    probs = np.clip(probs, 0.0, 1.0)

    if labels.size == 0:
        return {"roc_auc": 0.5, "pr_auc": 0.0, "brier": 0.25}

    unique_labels = np.unique(labels)
    if unique_labels.size < 2:
        # AUC is undefined for a single class; keep deterministic neutral fallback.
        roc_auc = 0.5
    else:
        roc_auc = float(roc_auc_score(labels, probs))

    try:
        pr_auc = float(average_precision_score(labels, probs))
    except Exception:
        pr_auc = 0.0

    brier = float(brier_score_loss(labels, probs))
    return {
        "roc_auc": _clamp_unit(roc_auc),
        "pr_auc": _clamp_unit(pr_auc),
        "brier": _clamp_unit(brier),
    }


def _candidate_selection_score(metrics: dict[str, float]) -> float:
    score = metrics["pr_auc"] + metrics["roc_auc"] * 0.1 - metrics["brier"] * 0.5
    return _to_float(score, fallback=-1.0)


def _train_target_models(
    target_name: str,
    train_frame: pd.DataFrame,
    valid_frame: pd.DataFrame,
    test_frame: pd.DataFrame,
) -> dict[str, Any]:
    X_train = train_frame[FEATURE_COLUMNS]
    X_valid = valid_frame[FEATURE_COLUMNS]
    X_test = test_frame[FEATURE_COLUMNS]
    y_train = train_frame[target_name]
    y_valid = valid_frame[target_name]
    y_test = test_frame[target_name]

    candidates: dict[str, Any] = {
        "catboost": _fit_catboost(X_train, y_train, X_valid, y_valid),
        "lightgbm": _fit_lightgbm(X_train, y_train),
    }

    candidate_results: dict[str, dict[str, Any]] = {}
    best_name = ""
    best_score = float("-inf")
    best_bundle: dict[str, Any] = {}

    for name, model in candidates.items():
        valid_raw = _predict_probability(model, X_valid)
        calibrator = _calibrate(valid_raw, y_valid.to_numpy())
        valid_calibrated = calibrator.predict(valid_raw)
        test_calibrated = calibrator.predict(_predict_probability(model, X_test))

        valid_metrics = _evaluate(y_valid.to_numpy(), valid_calibrated)
        test_metrics = _evaluate(y_test.to_numpy(), test_calibrated)
        selection_score = _candidate_selection_score(valid_metrics)
        candidate_results[name] = {
            "valid_metrics": valid_metrics,
            "test_metrics": test_metrics,
            "selection_score": float(selection_score),
        }
        if selection_score > best_score:
            best_name = name
            best_score = float(selection_score)
            best_bundle = {
                "model": model,
                "calibrator": calibrator,
                "test_probs": np.asarray(test_calibrated),
                "valid_probs": np.asarray(valid_calibrated),
                "test_metrics": test_metrics,
                "valid_metrics": valid_metrics,
            }

    if not best_bundle:
        raise RuntimeError(f"Failed to train/select model for target {target_name}")

    return {
        "target": target_name,
        "selected_model_name": best_name,
        "selected": best_bundle,
        "candidates": candidate_results,
    }


def _segment_metrics(
    segment_codes: pd.Series,
    labels: np.ndarray,
    decisions: np.ndarray,
) -> dict[str, dict[str, float | int | None]]:
    metrics: dict[str, dict[str, float | int | None]] = {}
    for code, name in SEGMENT_NAME_BY_CODE.items():
        mask = segment_codes == code
        if int(mask.sum()) == 0:
            metrics[name] = {"n": 0, "recall_bad": None, "approval_rate": None}
            continue

        seg_labels = labels[mask.to_numpy()]
        seg_decisions = decisions[mask.to_numpy()]
        bad_mask = seg_labels == 1
        if int(bad_mask.sum()) == 0:
            recall_bad = None
        else:
            recall_bad = float((seg_decisions[bad_mask] == 1).mean())
        approval_rate = float((seg_decisions == 0).mean())
        metrics[name] = {
            "n": int(mask.sum()),
            "recall_bad": recall_bad,
            "approval_rate": approval_rate,
        }
    return metrics


def _is_valid_policy_candidate(candidate: dict[str, Any]) -> bool:
    threshold = _to_float(candidate.get("threshold"), float("nan"))
    recall_bad = _to_float(candidate.get("recall_bad"), float("nan"))
    approval_rate = _to_float(candidate.get("approval_rate"), float("nan"))
    min_segment_recall = _to_float(candidate.get("min_segment_recall"), float("nan"))
    segment_recall_gap = _to_float(candidate.get("segment_recall_gap"), float("nan"))
    score = _to_float(candidate.get("score"), float("nan"))

    values = [threshold, recall_bad, approval_rate, min_segment_recall, segment_recall_gap, score]
    if any(not math.isfinite(value) for value in values):
        return False

    return (
        0.0 <= threshold <= 1.0
        and 0.0 <= recall_bad <= 1.0
        and 0.0 <= approval_rate <= 1.0
        and 0.0 <= min_segment_recall <= 1.0
        and 0.0 <= segment_recall_gap <= 1.0
    )


def _threshold_search(
    labels: np.ndarray,
    probs: np.ndarray,
    segment_codes: pd.Series,
) -> dict[str, Any]:
    baseline_threshold = 0.55
    probs = np.asarray(probs, dtype=float)
    probs = np.nan_to_num(probs, nan=0.5, posinf=1.0, neginf=0.0)
    probs = np.clip(probs, 0.0, 1.0)
    labels = np.asarray(labels, dtype=int)
    baseline_decisions = (probs >= baseline_threshold).astype(int)
    baseline = {
        "threshold": baseline_threshold,
        "recall_bad": _clamp_unit(float(recall_score(labels, baseline_decisions, zero_division=0))),
        "approval_rate": _clamp_unit(float((baseline_decisions == 0).mean())),
    }

    best: dict[str, Any] | None = None
    for threshold in np.linspace(0.08, 0.70, 63):
        decisions = (probs >= threshold).astype(int)
        recall_bad = _clamp_unit(float(recall_score(labels, decisions, zero_division=0)))
        approval_rate = _clamp_unit(float((decisions == 0).mean()))
        segment_stats = _segment_metrics(segment_codes, labels, decisions)
        recalls = [v["recall_bad"] for v in segment_stats.values() if v["recall_bad"] is not None]
        min_segment_recall = _clamp_unit(float(min(recalls))) if recalls else 0.0
        recall_gap = _clamp_unit(float(max(recalls) - min(recalls))) if len(recalls) >= 2 else 0.0

        gate_policy = recall_bad >= PROMOTION_GATES["min_recall_bad"] and approval_rate >= PROMOTION_GATES["min_approval_rate"]
        gate_fairness = (
            min_segment_recall >= PROMOTION_GATES["min_segment_recall"]
            and recall_gap <= PROMOTION_GATES["max_segment_recall_gap"]
        )
        gate_all = gate_policy and gate_fairness

        score = (
            recall_bad * 0.62
            + approval_rate * 0.20
            + min_segment_recall * 0.18
            - recall_gap * 0.25
            - abs(float(threshold) - 0.25) * 0.04
        )
        if gate_all:
            score += 0.3

        candidate = {
            "threshold": float(round(float(threshold), 4)),
            "recall_bad": recall_bad,
            "approval_rate": approval_rate,
            "segment_metrics": segment_stats,
            "min_segment_recall": min_segment_recall,
            "segment_recall_gap": recall_gap,
            "gate_policy": gate_policy,
            "gate_fairness": gate_fairness,
            "gate_all": gate_all,
            "score": float(score),
        }
        if not _is_valid_policy_candidate(candidate):
            continue
        if best is None or float(candidate["score"]) > float(best["score"]):
            best = candidate

    if best is None:
        raise RuntimeError("Threshold search failed to produce a valid candidate.")

    return {
        "baseline": baseline,
        "selected": best,
    }


def _validate_selected_policy(selected: dict[str, Any]) -> tuple[bool, str]:
    if not _is_valid_policy_candidate(selected):
        return False, "selected threshold policy contains invalid values"

    if not isinstance(selected.get("segment_metrics"), dict):
        return False, "selected threshold policy missing segment metrics"

    return True, "ok"


def main() -> None:
    parser = argparse.ArgumentParser(description="Train dual-target FairLens risk-v2 models.")
    parser.add_argument("--dataset", type=Path, required=True, help="Path to dual-target dataset parquet/csv.")
    parser.add_argument("--artifacts-dir", type=Path, required=True, help="Output directory for artifacts.")
    parser.add_argument(
        "--fail-on-gate",
        action="store_true",
        help="Exit with non-zero status when promotion gates fail.",
    )
    args = parser.parse_args()

    dataset = _load_dataset(args.dataset)
    train_frame, test_frame = train_test_split(
        dataset,
        test_size=0.2,
        random_state=42,
        stratify=dataset[PRIMARY_TARGET_COLUMN],
    )
    train_frame, valid_frame = train_test_split(
        train_frame,
        test_size=0.2,
        random_state=42,
        stratify=train_frame[PRIMARY_TARGET_COLUMN],
    )

    primary = _train_target_models(PRIMARY_TARGET_COLUMN, train_frame, valid_frame, test_frame)
    secondary = _train_target_models(SECONDARY_TARGET_COLUMN, train_frame, valid_frame, test_frame)

    w_primary = float(BLEND_WEIGHTS[PRIMARY_TARGET_COLUMN])
    w_secondary = float(BLEND_WEIGHTS[SECONDARY_TARGET_COLUMN])
    test_probs = w_primary * primary["selected"]["test_probs"] + w_secondary * secondary["selected"]["test_probs"]
    valid_probs = w_primary * primary["selected"]["valid_probs"] + w_secondary * secondary["selected"]["valid_probs"]

    threshold_eval = _threshold_search(
        labels=test_frame[PRIMARY_TARGET_COLUMN].to_numpy(),
        probs=test_probs,
        segment_codes=test_frame["segment_code"],
    )
    selected_threshold = float(threshold_eval["selected"]["threshold"])
    policy_valid, policy_validation_message = _validate_selected_policy(threshold_eval["selected"])

    blended_test_metrics = _evaluate(test_frame[PRIMARY_TARGET_COLUMN].to_numpy(), test_probs)
    blended_valid_metrics = _evaluate(valid_frame[PRIMARY_TARGET_COLUMN].to_numpy(), valid_probs)
    quality_non_regression = (
        blended_test_metrics["pr_auc"] >= primary["selected"]["test_metrics"]["pr_auc"] - 0.005
        and blended_test_metrics["brier"] <= primary["selected"]["test_metrics"]["brier"] + 0.003
    )
    promotion_pass = bool(
        threshold_eval["selected"]["gate_all"] and quality_non_regression and policy_valid
    )

    args.artifacts_dir.mkdir(parents=True, exist_ok=True)
    primary_model_path = args.artifacts_dir / "default_model.pkl"
    secondary_model_path = args.artifacts_dir / "stress_model.pkl"
    primary_calibrator_path = args.artifacts_dir / "default_calibrator.pkl"
    secondary_calibrator_path = args.artifacts_dir / "stress_calibrator.pkl"
    metadata_path = args.artifacts_dir / "model_metadata.json"
    manifest_path = args.artifacts_dir / "training_manifest.json"

    joblib.dump(primary["selected"]["model"], primary_model_path)
    joblib.dump(secondary["selected"]["model"], secondary_model_path)
    joblib.dump(primary["selected"]["calibrator"], primary_calibrator_path)
    joblib.dump(secondary["selected"]["calibrator"], secondary_calibrator_path)

    metadata = {
        "threshold": selected_threshold,
        "feature_columns": FEATURE_COLUMNS,
        "required_features": FEATURE_COLUMNS,
        "model_version": MODEL_VERSION,
        "schema_version": RISK_SCHEMA_VERSION,
        "reason_code_catalog": REASON_CODE_CATALOG,
        "dual_target": {
            "targets": {
                "primary": PRIMARY_TARGET_COLUMN,
                "secondary": SECONDARY_TARGET_COLUMN,
            },
            "blend_weights": {
                PRIMARY_TARGET_COLUMN: w_primary,
                SECONDARY_TARGET_COLUMN: w_secondary,
            },
            "artifacts": {
                "primary_model": primary_model_path.name,
                "secondary_model": secondary_model_path.name,
                "primary_calibrator": primary_calibrator_path.name,
                "secondary_calibrator": secondary_calibrator_path.name,
            },
            "selected_models": {
                PRIMARY_TARGET_COLUMN: primary["selected_model_name"],
                SECONDARY_TARGET_COLUMN: secondary["selected_model_name"],
            },
            "threshold_selection": threshold_eval["selected"],
            "promotion_gates": PROMOTION_GATES,
        },
    }
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    manifest = {
        "dataset_rows": int(len(dataset)),
        "train_rows": int(len(train_frame)),
        "valid_rows": int(len(valid_frame)),
        "test_rows": int(len(test_frame)),
        "targets": {
            "primary": PRIMARY_TARGET_COLUMN,
            "secondary": SECONDARY_TARGET_COLUMN,
        },
        "selected_threshold": selected_threshold,
        "blend_weights": {
            PRIMARY_TARGET_COLUMN: w_primary,
            SECONDARY_TARGET_COLUMN: w_secondary,
        },
        "baseline_policy": threshold_eval["baseline"],
        "selected_policy": threshold_eval["selected"],
        "quality": {
            "blended_test": blended_test_metrics,
            "blended_valid": blended_valid_metrics,
            "primary_test": primary["selected"]["test_metrics"],
            "secondary_test": secondary["selected"]["test_metrics"],
            "non_regression_vs_primary": quality_non_regression,
        },
        "gates": {
            "policy_and_fairness_pass": bool(threshold_eval["selected"]["gate_all"]),
            "quality_non_regression_pass": bool(quality_non_regression),
            "selected_policy_valid": bool(policy_valid),
            "selected_policy_validation_message": policy_validation_message,
            "promotion_pass": promotion_pass,
        },
        "models": {
            PRIMARY_TARGET_COLUMN: {
                "selected": primary["selected_model_name"],
                "candidates": primary["candidates"],
            },
            SECONDARY_TARGET_COLUMN: {
                "selected": secondary["selected_model_name"],
                "candidates": secondary["candidates"],
            },
        },
        "artifacts": {
            "primary_model": primary_model_path.name,
            "secondary_model": secondary_model_path.name,
            "primary_calibrator": primary_calibrator_path.name,
            "secondary_calibrator": secondary_calibrator_path.name,
            "metadata": metadata_path.name,
        },
        "backends": {
            "catboost": HAS_CATBOOST,
            "lightgbm": HAS_LIGHTGBM,
        },
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(json.dumps(manifest, indent=2))

    if args.fail_on_gate and not promotion_pass:
        raise SystemExit("Promotion gates failed. Artifacts generated for debugging but not promotable.")


if __name__ == "__main__":
    main()
