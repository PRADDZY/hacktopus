# Wave 18: Idempotency Recovery on Server Errors

Date: 2026-03-26

## Implemented

- Added explicit idempotency recovery for mutation routes when downstream/server failures occur.
- Released `in_progress` idempotency records on `5xx` failures so clients can retry with the same `Idempotency-Key`.
- Kept normal replay/finalization behavior unchanged for successful and deterministic client-error outcomes.

## Updated Files

- `worker-api/src/supabase.ts`
- `worker-api/src/idempotency.ts`
- `worker-api/src/routes/domain.ts`
- `worker-api/tests/domain-routes.test.ts`
- `worker-api/README.md`

## Verification

- `worker-api`: `npm test -- --run` -> pass
- `worker-api`: `npx tsc --noEmit` -> pass

