# Wave 7: Worker Application Domain Migration

Date: 2026-03-26

## Implemented

- Migrated checkout/admin application APIs into Cloudflare Worker:
  - `POST /v1/applications`
  - `GET /v1/applications/me`
  - `GET /v1/admin/applications`
  - `GET /v1/admin/applications/:applicationUuid`
  - `POST /v1/admin/applications/:applicationUuid/override`
- Added Worker-admin analytics endpoints:
  - `GET /v1/stats`
  - `GET /v1/logs`
  - `GET /v1/audit-logs`
- Preserved scoring behavior for checkout applications by deriving the same risk-v2 feature payload from EMI input and using ML endpoint + fallback scoring.
- Added optional idempotency support for `POST /v1/applications` with replay/conflict/in-progress handling aligned to existing Worker patterns.
- Updated frontend API client to support both legacy backend JSON and Worker response envelope (`data/error/meta`) with environment split:
  - `NEXT_PUBLIC_API_URL` for Worker app domain routes
  - `NEXT_PUBLIC_RISK_API_URL` for `/predict` compatibility route if needed

## Updated Files

- `worker-api/src/routes/domain.ts`
- `worker-api/tests/domain-routes.test.ts`
- `worker-api/README.md`
- `frontend/lib/fairlensApi.ts`
- `frontend/tests/unit/fairlensApi.test.ts`
- `frontend/README.md`
- `README.md`

## Verification

- `worker-api`: `npm test -- --run` -> pass (`29 passed`)
- `frontend`: `npm run test -- --run` -> pass
- `frontend`: `npm run lint` -> pass
- `frontend`: `npm run build` -> pass

