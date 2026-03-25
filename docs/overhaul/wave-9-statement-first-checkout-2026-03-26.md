# Wave 9: Statement-First Checkout Integration

Date: 2026-03-26

## Implemented

- Replaced checkout EMI decision path from direct `/v1/applications` call to statement-first Worker flow:
  1. `POST /v1/documents`
  2. `GET /v1/extraction-jobs/:id` (short poll loop)
  3. `POST /v1/assessments`
- Added frontend API client methods for statement-domain routes:
  - `createStatementDocument`
  - `fetchExtractionJob`
  - `createAssessment`
- Added statement transaction handling in checkout:
  - CSV parsing path for uploaded statement files
  - deterministic synthetic transaction fallback for non-CSV uploads (demo reliability path)
- Updated EMI result rendering to use assessment identifiers (`ASM-*`) instead of application identifiers.
- Added/updated tests for new statement-domain API calls and e2e route mocks.

## Updated Files

- `frontend/app/(shop)/checkout/page.tsx`
- `frontend/lib/fairlensApi.ts`
- `frontend/types/index.ts`
- `frontend/tests/unit/fairlensApi.test.ts`
- `frontend/tests/e2e/checkout-flow.spec.ts`
- `frontend/app/(shop)/orders/page.tsx`
- `frontend/README.md`
- `README.md`

## Verification

- `frontend`: `npm run test -- --run` -> pass
- `frontend`: `npm run lint` -> pass
- `frontend`: `npm run build` -> pass
- `worker-api`: `npm test -- --run` -> pass (`30 passed`)
- `backend`: `python -m pytest -q` -> pass
- `ml-service`: `python -m pytest -q` -> pass

