# Wave 6: Dual-Target ML Upgrade

Date: 2026-03-25

## Implemented

- Upgraded training schema to dual targets:
  - `default_90d_proxy` (primary repayment/default signal)
  - `affordability_stress_proxy` (secondary affordability signal)
- Reworked proxy dataset builder to generate:
  - risk-v2 feature contract columns
  - diversified segment mapping (`student`, `gig_worker`, `informal_worker`)
  - both target columns in one dataset output
- Replaced single-target training script with dual-target training:
  - candidate models per target: CatBoost + LightGBM (with sklearn fallback)
  - isotonic calibration per selected target model
  - blended risk score using fixed weights (`0.70` primary, `0.30` secondary)
  - threshold search with fairness-aware policy scoring
  - promotion gates recorded in manifest
- Extended ML inference runtime to load dual-target artifacts from `MODEL_ARTIFACT_DIR`:
  - `default_model.pkl`, `stress_model.pkl`
  - `default_calibrator.pkl`, `stress_calibrator.pkl`
  - blend weights from metadata
- Kept `/predict` response shape unchanged (`risk-v2.0.0` contract preserved).

## Updated Files

- `ml-service/training/feature_schema.py`
- `ml-service/training/build_proxy_dataset.py`
- `ml-service/training/train_ensemble.py`
- `ml-service/training/README.md`
- `ml-service/training/requirements.txt`
- `ml-service/main.py`
- `ml-service/tests/test_service.py`
- `ml-service/tests/test_training_pipeline.py`

## Verification

- `ml-service`: `python -m pytest -q` -> pass (`9 passed`)
- Syntax check:
  - `python -m py_compile training/build_proxy_dataset.py training/train_ensemble.py main.py` -> pass
- Smoke train run on synthetic local dataset:
  - `python train_ensemble.py --dataset ..\\pytest_cache\\dual_target_smoke.csv --artifacts-dir ..\\pytest_cache\\risk_v2_smoke` -> pass
