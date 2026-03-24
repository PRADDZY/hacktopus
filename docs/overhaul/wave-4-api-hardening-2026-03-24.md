# Wave 4: API Contract Hardening + Idempotency

Date: 2026-03-24

## Implemented

- Unified response envelope on all Worker endpoints, including auth and health routes:
  - `{ data, error, meta: { requestId, timestamp } }`
- Added request context middleware:
  - Reuses `X-Request-Id` when provided.
  - Generates request id when missing.
  - Returns `X-Request-Id` in all responses.
- Added mutation idempotency for:
  - `POST /v1/documents`
  - `POST /v1/assessments`
- Added admin list contract improvements:
  - `GET /v1/admin/assessments` filters: `status`, `owner_sub`, `reviewed_by`, `decision_source`, `q`.
  - Accurate `total` and `total_pages` from exact count headers.
- Added Supabase migration for idempotency storage table.

## Files

- `worker-api/src/http.ts`
- `worker-api/src/app.ts`
- `worker-api/src/auth.ts`
- `worker-api/src/idempotency.ts`
- `worker-api/src/supabase.ts`
- `worker-api/src/routes/domain.ts`
- `worker-api/tests/auth-middleware.test.ts`
- `worker-api/tests/domain-routes.test.ts`
- `worker-api/tests/extraction-lifecycle.test.ts`
- `backend/supabase/migrations/0004_api_idempotency.sql`
- `backend/supabase/README.md`
- `worker-api/README.md`
- `README.md`

## Verification

- `worker-api`: `npx tsc --noEmit` -> pass
- `worker-api`: `npm test` -> blocked in current sandbox (`spawn EPERM` while running Vitest on Windows path)

## Notes

- Idempotency entries are scoped by `(owner_sub, route_key, idempotency_key)`.
- Default idempotency retention is 24 hours (`IDEMPOTENCY_TTL_SECONDS=86400`).
