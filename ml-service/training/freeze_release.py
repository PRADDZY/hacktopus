from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def _load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise RuntimeError(f"Required file not found: {path}")
    with path.open("r", encoding="utf-8") as file:
        payload = json.load(file)
    if not isinstance(payload, dict):
        raise RuntimeError(f"Expected JSON object in {path}")
    return payload


def _sha256(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def _build_file_entry(path: Path) -> dict[str, Any]:
    return {
        "name": path.name,
        "size_bytes": int(path.stat().st_size),
        "sha256": _sha256(path),
    }


def _required_artifact_names(metadata: dict[str, Any]) -> list[str]:
    dual_target = metadata.get("dual_target")
    if not isinstance(dual_target, dict):
        raise RuntimeError("model_metadata.json missing 'dual_target' section.")

    artifacts = dual_target.get("artifacts")
    if not isinstance(artifacts, dict):
        raise RuntimeError("model_metadata.json missing dual_target.artifacts section.")

    required_keys = [
        "primary_model",
        "secondary_model",
        "primary_calibrator",
        "secondary_calibrator",
    ]

    names: list[str] = []
    for key in required_keys:
        value = artifacts.get(key)
        if not isinstance(value, str) or not value.strip():
            raise RuntimeError(f"model_metadata.json missing artifact mapping for '{key}'.")
        names.append(value.strip())
    return names


def _validate_gates(training_manifest: dict[str, Any]) -> tuple[bool, str]:
    gates = training_manifest.get("gates")
    if not isinstance(gates, dict):
        return False, "training_manifest missing gates section"

    checks = {
        "promotion_pass": bool(gates.get("promotion_pass", False)),
        "policy_and_fairness_pass": bool(gates.get("policy_and_fairness_pass", False)),
        "quality_non_regression_pass": bool(gates.get("quality_non_regression_pass", False)),
        "selected_policy_valid": bool(gates.get("selected_policy_valid", False)),
    }
    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        return False, f"gate check failed: {', '.join(failed)}"
    return True, "ok"


def build_release_manifest(
    artifacts_dir: Path,
    metadata: dict[str, Any],
    training_manifest: dict[str, Any],
    notes: str | None = None,
) -> tuple[dict[str, Any], list[Path]]:
    artifact_names = _required_artifact_names(metadata)
    required_paths = [
        artifacts_dir / "model_metadata.json",
        artifacts_dir / "training_manifest.json",
        *[artifacts_dir / name for name in artifact_names],
    ]

    missing = [str(path) for path in required_paths if not path.exists()]
    if missing:
        raise RuntimeError(f"Release freeze failed. Missing artifacts: {missing}")

    files = [_build_file_entry(path) for path in required_paths]

    dual_target = metadata.get("dual_target", {})
    manifest = {
        "release_type": "ml-dual-target",
        "created_at_utc": datetime.now(UTC).isoformat(),
        "model_version": metadata.get("model_version"),
        "schema_version": metadata.get("schema_version"),
        "threshold": metadata.get("threshold"),
        "targets": dual_target.get("targets"),
        "blend_weights": dual_target.get("blend_weights"),
        "promotion_gates": training_manifest.get("gates"),
        "runtime": {
            "recommended_model_runtime_mode": "dual_target",
            "legacy_json_fallback_enabled": False,
        },
        "files": files,
        "notes": notes or "",
    }

    return manifest, required_paths


def freeze_release(
    artifacts_dir: Path,
    output_path: Path,
    release_dir: Path | None,
    allow_gate_fail: bool,
    notes: str | None,
) -> Path:
    artifacts_dir = artifacts_dir.resolve()
    metadata = _load_json(artifacts_dir / "model_metadata.json")
    training_manifest = _load_json(artifacts_dir / "training_manifest.json")

    gates_ok, gate_message = _validate_gates(training_manifest)
    if not gates_ok and not allow_gate_fail:
        raise RuntimeError(f"Release freeze blocked: {gate_message}")

    release_manifest, files_to_bundle = build_release_manifest(
        artifacts_dir=artifacts_dir,
        metadata=metadata,
        training_manifest=training_manifest,
        notes=notes,
    )
    release_manifest["gate_validation"] = {
        "passed": gates_ok,
        "message": gate_message,
        "allow_gate_fail": bool(allow_gate_fail),
    }

    if release_dir is not None:
        release_dir = release_dir.resolve()
        release_dir.mkdir(parents=True, exist_ok=True)
        for file_path in files_to_bundle:
            shutil.copy2(file_path, release_dir / file_path.name)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(release_manifest, indent=2), encoding="utf-8")
    return output_path


def _resolve_output_path(artifacts_dir: Path, release_dir: Path | None, output: Path | None) -> Path:
    if output is not None:
        return output.resolve()
    if release_dir is not None:
        return release_dir.resolve() / "release_manifest.json"
    return artifacts_dir.resolve() / "release_manifest.json"


def main() -> None:
    parser = argparse.ArgumentParser(description="Freeze promotable ML artifacts into a release manifest.")
    parser.add_argument("--artifacts-dir", type=Path, required=True, help="Directory containing training artifacts.")
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional output path for release manifest (defaults to artifacts-dir/release_manifest.json).",
    )
    parser.add_argument(
        "--release-dir",
        type=Path,
        default=None,
        help="Optional directory to copy release artifact bundle files.",
    )
    parser.add_argument(
        "--allow-gate-fail",
        action="store_true",
        help="Generate release manifest even when promotion gates fail.",
    )
    parser.add_argument("--notes", type=str, default=None, help="Optional release notes for manifest metadata.")
    args = parser.parse_args()

    output_path = _resolve_output_path(args.artifacts_dir, args.release_dir, args.output)
    written_path = freeze_release(
        artifacts_dir=args.artifacts_dir,
        output_path=output_path,
        release_dir=args.release_dir,
        allow_gate_fail=bool(args.allow_gate_fail),
        notes=args.notes,
    )
    print(str(written_path))


if __name__ == "__main__":
    main()

