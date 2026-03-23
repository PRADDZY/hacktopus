# Wave 3: Modal Extraction Lifecycle (Worker API)

Date: 2026-03-24

## Implemented

- Added async extraction lifecycle behavior in Worker domain layer:
  - Modal dispatch on `POST /v1/documents` when `MODAL_EXTRACTION_ENDPOINT` is configured.
  - Owner/admin status polling via `GET /v1/extraction-jobs/:id`.
  - Secure callback handler via `POST /v1/extraction-jobs/:id/callback` guarded by `X-Callback-Secret`.
- Callback behavior:
  - Updates `extraction_jobs` status (`processing|completed|failed`).
  - Updates `documents` status (`processing|ready|failed`).
  - Inserts/updates `extracted_features` on completed callbacks.

## Files

- `worker-api/src/routes/domain.ts`
- `worker-api/src/types.ts`
- `worker-api/tests/extraction-lifecycle.test.ts`
- `worker-api/README.md`
- `worker-api/.dev.vars.example`
- `worker-api/wrangler.toml`

## Verification

- `worker-api`: `npm test` -> `17 passed`
- `worker-api`: `npx tsc --noEmit` -> pass

## Notes

- Modal dispatch is optional and only runs when `MODAL_EXTRACTION_ENDPOINT` is present.
- Assessment creation can still accept direct feature payloads as fallback.
