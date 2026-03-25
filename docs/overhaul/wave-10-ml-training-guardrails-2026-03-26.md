# Wave 10: ML Training Guardrails and Promotion Safety

Date: 2026-03-26

## Implemented

- Hardened training metric evaluation against single-class and NaN/inf edge cases.
- Added strict policy-candidate validation during threshold search to prevent invalid selection payloads.
- Added selected-policy validation status into `training_manifest.json`.
- Added `--fail-on-gate` option to `train_ensemble.py` so CI/manual runs can fail fast when promotion gates are not met.
- Ensured promotion pass now depends on:
  - policy/fairness gates
  - quality non-regression checks
  - selected policy validity checks

## Updated Files

- `ml-service/training/train_ensemble.py`
- `ml-service/tests/test_training_pipeline.py`
- `ml-service/training/README.md`

## Verification

- `ml-service`: `python -m pytest -q` -> pass
- `backend`: `python -m pytest -q` -> pass
- `frontend`: `npm run test -- --run` -> pass
- `worker-api`: `npm test -- --run` -> pass

