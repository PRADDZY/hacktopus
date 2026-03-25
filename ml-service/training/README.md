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
  --artifacts-dir ../../local/models/risk_v2
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

## 4) Promote artifacts to inference service

Copy selected artifacts to `ml-service/` and set:

- `MODEL_ARTIFACT_DIR`
- `MODEL_METADATA_PATH`

Inference API contract remains `risk-v2.0.0` and returns the same response shape.
