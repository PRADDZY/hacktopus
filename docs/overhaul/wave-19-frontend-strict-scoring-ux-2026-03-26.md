# Wave 19: Frontend Strict-Scoring UX + Typed API Errors

Date: 2026-03-26

## Implemented

- Added typed frontend API error model:
  - `FairlensApiError` with `status`, `code`, `details`, and `requestId`.
  - `isFairlensApiError` type guard for safe UI handling.
- Upgraded frontend API client error parsing to preserve server envelope error codes and request IDs.
- Updated checkout error handling for strict Worker scoring mode:
  - explicit user message for `model_unavailable`
  - explicit user message for `idempotency_in_progress`
  - resilient fallback message for generic `5xx` failures
- Added regression coverage to confirm typed error propagation from envelope errors.

## Updated Files

- `frontend/lib/fairlensApi.ts`
- `frontend/app/(shop)/checkout/page.tsx`
- `frontend/tests/unit/fairlensApi.test.ts`

## Verification

- `frontend`: `npm run lint` -> pass
- `frontend`: `npm run test -- --run` -> pass
- `frontend`: `npm run build` -> pass

