# Wave 12: Demo Runbook + Smoke Operations

Date: 2026-03-26

## Implemented

- Added deploy-time/demo-time operational runbook:
  - environment matrix (frontend + worker + ml)
  - pre-demo checklist
  - judge-facing demo flow
  - fallback plan for live failures
- Added executable Worker smoke validation script:
  - `worker-api/scripts/demo-smoke.mjs`
  - validates health, assistant, auth context, and optional authenticated/admin endpoints
- Added worker npm command:
  - `npm run smoke`
- Updated top-level and worker docs to reflect:
  - Worker as primary runtime
  - backend as legacy compatibility mode
  - smoke command and demo runbook links

## Updated Files

- `worker-api/scripts/demo-smoke.mjs`
- `worker-api/package.json`
- `worker-api/README.md`
- `docs/demo/demo-runbook.md`
- `README.md`

## Verification

- `worker-api`: `npm test -- --run` -> pass
- `frontend`: `npm run test -- --run` -> pass
- `frontend`: `npm run lint` -> pass
- `frontend`: `npm run build` -> pass
- `backend`: `python -m pytest -q` -> pass
- `ml-service`: `python -m pytest -q` -> pass

