# Wave 23: Core Runtime Deslop (Behavior-Preserving)

Date: 2026-03-26

## Implemented

- Worker mutation route cleanup:
  - extracted shared idempotency mutation helpers into `domain-mutation.ts`
  - removed repeated mutation catch-branch boilerplate in:
    - `POST /v1/applications`
    - `POST /v1/documents`
    - `POST /v1/assessments`
- Frontend API client cleanup:
  - added a single `requestJson` pipeline in `fairlensApi.ts`
  - removed repetitive fetch + error handling blocks across API functions
- Checkout page orchestration cleanup:
  - moved assessment execution and error mapping into `checkoutAssessment.ts`
  - reduced non-UI orchestration complexity inside checkout page component

## Updated Files

- `worker-api/src/routes/domain.ts`
- `worker-api/src/routes/domain-mutation.ts`
- `frontend/lib/fairlensApi.ts`
- `frontend/app/(shop)/checkout/page.tsx`
- `frontend/lib/checkoutAssessment.ts`

## Verification

- `worker-api`: `npm test -- --run` -> pass (`35 passed`)
- `worker-api`: `npx tsc --noEmit` -> pass
- `frontend`: `npm run lint` -> pass
- `frontend`: `npm run test -- --run` -> pass
- `frontend`: `npm run build` -> pass

