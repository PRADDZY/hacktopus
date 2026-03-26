# FairLens Training Pipeline (Wave 6)

This folder contains the dual-target training pipeline for the `risk-v2` model overhaul.

## 1) Prepare raw datasets (manual drop-in)

Place source files under local-only paths (already ignored by git):

- `local/data/raw/home_credit/application_train.csv`
- `local/data/raw/give_me_some_credit/cs-training.csv`
- `local/data/raw/heloc/heloc_dataset.csv`

## 2) Build unified dual-target proxy dataset

```bash
cd ml-service/training
python build_proxy_dataset.py \
  --home-credit ../../local/data/raw/home_credit/application_train.csv \
  --gmsc ../../local/data/raw/give_me_some_credit/cs-training.csv \
  --heloc ../../local/data/raw/heloc/heloc_dataset.csv \
  --output ../../local/data/processed/risk_v2_proxy.parquet
```

The output contains:

- `default_90d_proxy`
- `affordability_stress_proxy`

## 3) Train dual-target models and blended policy

```bash
cd ml-service/training
python train_ensemble.py \
  --dataset ../../local/data/processed/risk_v2_proxy.parquet \
  --artifacts-dir ../../local/models/risk_v2 \
  --fail-on-gate
```

Outputs:

- `default_model.pkl`
- `stress_model.pkl`
- `default_calibrator.pkl`
- `stress_calibrator.pkl`
- `model_metadata.json`
- `training_manifest.json`

`training_manifest.json` includes:

- candidate model metrics for each target
- blended-policy threshold selection
- segment fairness stats (`student`, `gig_worker`, `informal_worker`)
- promotion gate pass/fail summary
- selected policy validity checks (guards against invalid/NaN/-sentinel promotions)

## 4) Freeze promotable release bundle

```bash
cd ml-service/training
python freeze_release.py \
  --artifacts-dir ../../local/models/risk_v2 \
  --release-dir ../../local/models/risk_v2_release
```

This validates promotion gates from `training_manifest.json`, verifies required dual-target artifacts, and writes a `release_manifest.json` with checksums for reproducible deployment handoff.

## 5) Promote artifacts to inference service

Copy selected artifacts to `ml-service/` and set:

- `MODEL_ARTIFACT_DIR`
- `MODEL_METADATA_PATH`
- `MODEL_RUNTIME_MODE=dual_target`

Inference API contract remains `risk-v2.0.0` and returns the same response shape.
