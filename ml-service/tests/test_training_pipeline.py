from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

TRAINING_DIR = Path(__file__).resolve().parents[1] / "training"
if str(TRAINING_DIR) not in sys.path:
    sys.path.append(str(TRAINING_DIR))

import build_proxy_dataset as dataset_builder
import feature_schema
import freeze_release
import train_ensemble


def test_affordability_target_builder_outputs_binary():
    frame = pd.DataFrame(
        {
            "total_burden_ratio": [0.2, 0.5, 0.8, 1.1],
            "stress_index": [0.2, 0.4, 0.7, 0.9],
            "buffer_ratio": [0.5, 0.3, 0.1, 0.0],
            "negative_balance_days_30d": [0, 2, 5, 9],
            "installment_to_inflow_ratio": [0.05, 0.1, 0.18, 0.3],
        }
    )
    target = dataset_builder._derive_affordability_target(frame)
    assert set(target.unique()).issubset({0, 1})
    assert len(target) == len(frame)


def test_load_dataset_requires_dual_targets(tmp_path):
    dataset = pd.DataFrame({column: np.full(8, 0.5) for column in feature_schema.FEATURE_COLUMNS})
    dataset[feature_schema.PRIMARY_TARGET_COLUMN] = [0, 1, 0, 1, 0, 1, 0, 1]
    dataset[feature_schema.SECONDARY_TARGET_COLUMN] = [0, 0, 1, 1, 0, 0, 1, 1]
    path = tmp_path / "dual_target.csv"
    dataset.to_csv(path, index=False)

    loaded = train_ensemble._load_dataset(path)
    assert feature_schema.PRIMARY_TARGET_COLUMN in loaded.columns
    assert feature_schema.SECONDARY_TARGET_COLUMN in loaded.columns
    assert len(loaded) == len(dataset)


def test_threshold_search_returns_policy_fields():
    labels = np.array([0, 1, 0, 1, 0, 1, 1, 0], dtype=int)
    probs = np.array([0.12, 0.74, 0.25, 0.67, 0.29, 0.61, 0.72, 0.18], dtype=float)
    segment_codes = pd.Series([0, 0, 1, 1, 2, 2, 1, 0])

    result = train_ensemble._threshold_search(labels, probs, segment_codes)
    assert "baseline" in result
    assert "selected" in result
    selected = result["selected"]
    assert 0.08 <= float(selected["threshold"]) <= 0.70
    assert "gate_policy" in selected
    assert "gate_fairness" in selected
    assert train_ensemble._is_valid_policy_candidate(selected) is True


def test_evaluate_handles_single_class_without_nan():
    labels = np.zeros(8, dtype=int)
    probs = np.array([0.1, 0.15, 0.2, 0.4, 0.6, 0.7, 0.8, 0.9], dtype=float)

    metrics = train_ensemble._evaluate(labels, probs)
    assert set(metrics.keys()) == {"roc_auc", "pr_auc", "brier"}
    assert 0.0 <= metrics["roc_auc"] <= 1.0
    assert 0.0 <= metrics["pr_auc"] <= 1.0
    assert 0.0 <= metrics["brier"] <= 1.0


def _write_release_artifacts(artifacts_dir: Path, promotion_pass: bool) -> None:
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    required_files = [
        "default_model.pkl",
        "stress_model.pkl",
        "default_calibrator.pkl",
        "stress_calibrator.pkl",
    ]
    for name in required_files:
        (artifacts_dir / name).write_bytes(b"test-artifact")

    metadata = {
        "threshold": 0.23,
        "feature_columns": feature_schema.FEATURE_COLUMNS,
        "required_features": feature_schema.FEATURE_COLUMNS,
        "model_version": feature_schema.MODEL_VERSION,
        "schema_version": feature_schema.RISK_SCHEMA_VERSION,
        "reason_code_catalog": feature_schema.REASON_CODE_CATALOG,
        "dual_target": {
            "targets": {
                "primary": feature_schema.PRIMARY_TARGET_COLUMN,
                "secondary": feature_schema.SECONDARY_TARGET_COLUMN,
            },
            "blend_weights": {
                feature_schema.PRIMARY_TARGET_COLUMN: 0.7,
                feature_schema.SECONDARY_TARGET_COLUMN: 0.3,
            },
            "artifacts": {
                "primary_model": "default_model.pkl",
                "secondary_model": "stress_model.pkl",
                "primary_calibrator": "default_calibrator.pkl",
                "secondary_calibrator": "stress_calibrator.pkl",
            },
        },
    }
    (artifacts_dir / "model_metadata.json").write_text(json.dumps(metadata), encoding="utf-8")

    training_manifest = {
        "gates": {
            "promotion_pass": promotion_pass,
            "policy_and_fairness_pass": promotion_pass,
            "quality_non_regression_pass": promotion_pass,
            "selected_policy_valid": promotion_pass,
        }
    }
    (artifacts_dir / "training_manifest.json").write_text(json.dumps(training_manifest), encoding="utf-8")


def test_freeze_release_generates_manifest(tmp_path):
    artifacts_dir = tmp_path / "artifacts"
    _write_release_artifacts(artifacts_dir, promotion_pass=True)

    output_path = tmp_path / "release_manifest.json"
    written = freeze_release.freeze_release(
        artifacts_dir=artifacts_dir,
        output_path=output_path,
        release_dir=None,
        allow_gate_fail=False,
        notes="demo release",
    )

    assert written == output_path
    manifest = json.loads(output_path.read_text(encoding="utf-8"))
    assert manifest["release_type"] == "ml-dual-target"
    assert manifest["runtime"]["recommended_model_runtime_mode"] == "dual_target"
    assert manifest["gate_validation"]["passed"] is True
    assert len(manifest["files"]) == 6


def test_freeze_release_blocks_when_gates_fail(tmp_path):
    artifacts_dir = tmp_path / "artifacts"
    _write_release_artifacts(artifacts_dir, promotion_pass=False)

    output_path = tmp_path / "release_manifest.json"
    try:
        freeze_release.freeze_release(
            artifacts_dir=artifacts_dir,
            output_path=output_path,
            release_dir=None,
            allow_gate_fail=False,
            notes=None,
        )
    except RuntimeError as exc:
        assert "Release freeze blocked" in str(exc)
    else:
        raise AssertionError("Expected RuntimeError when promotion gates fail")
