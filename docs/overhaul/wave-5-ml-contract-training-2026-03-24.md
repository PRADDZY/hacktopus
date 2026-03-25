# Wave 5: ML Contract + Training Foundation

Date: 2026-03-24

## Implemented

- Hard-replaced prediction schema to `risk-v2.0.0` across backend, ml-service, frontend shared types, and worker assessment scoring.
- Extended `/predict` response to include:
  - `model_version`
  - `schema_version`
  - `calibration_bucket`
  - `reasons[]` (code/feature/direction/impact/message)
- Updated backend scoring flow:
  - Request normalization to V2 feature contract.
  - Fallback scoring remains available when remote ML is unavailable.
  - Audit/logging paths preserve compatibility with existing transaction storage fields.
- Updated worker assessment scoring:
  - Normalizes extracted features to V2 schema.
  - Calls external scoring endpoint when configured.
  - Falls back to local heuristic scoring when remote scoring is unavailable.
- Added Wave 5 training scaffold in `ml-service/training`:
  - Proxy dataset builder.
  - Ensemble training entrypoint.
  - Feature schema and requirements documentation.

## Files

- `backend/app/schemas/predict.py`
- `backend/app/services/model_service.py`
- `backend/app/services/applications.py`
- `backend/app/api/routes.py`
- `backend/tests/test_api.py`
- `backend/tests/test_audit_logs.py`
- `backend/tests/integration/test_predict_chain.py`
- `backend/tests/integration/test_auth_guards.py`
- `backend/README.md`
- `ml-service/main.py`
- `ml-service/model_metadata.json`
- `ml-service/tests/test_service.py`
- `ml-service/training/feature_schema.py`
- `ml-service/training/build_proxy_dataset.py`
- `ml-service/training/train_ensemble.py`
- `ml-service/training/README.md`
- `ml-service/training/requirements.txt`
- `frontend/types/index.ts`
- `frontend/tests/unit/fairlensApi.test.ts`
- `frontend/tests/e2e/checkout-flow.spec.ts`
- `worker-api/src/routes/domain.ts`
- `worker-api/src/types.ts`
- `worker-api/.dev.vars.example`
- `worker-api/wrangler.toml`
- `worker-api/README.md`
- `README.md`

## Verification

- `backend`: `python -m pytest -q` -> pass
- `ml-service`: `python -m pytest -q` -> pass
- `frontend`: `npm run lint` -> pass
- `frontend`: `npm run test` -> pass
- `worker-api`: `npx tsc --noEmit` -> pass
- `worker-api`: `npm test` -> blocked in current sandbox (`spawn EPERM` while Vitest starts worker processes)

## Notes

- V2 schema rollout keeps alias compatibility for legacy model feature names during transition.
- Current local scoring fallback is intentionally deterministic and explainable until trained ensemble artifacts are promoted.
