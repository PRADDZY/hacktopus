# FairLens Worker API (Wave 1 Foundation)

Cloudflare Worker API scaffold for the migration from FastAPI runtime to Cloudflare fullstack.

## Current Scope

- Health endpoint: `GET /health`
- Auth context endpoint: `GET /auth/me`
- Guarded route examples:
  - `GET /v1/protected/user` (requires authenticated token when `AUTH_REQUIRED=true`)
  - `GET /v1/protected/admin` (requires admin role)
- Domain foundation endpoints:
  - `POST /v1/documents`
  - `GET /v1/documents/:id`
  - `GET /v1/extraction-jobs/:id`
  - `POST /v1/extraction-jobs/:id/callback`
  - `POST /v1/assessments`
  - `GET /v1/assessments/me`
  - `GET /v1/admin/assessments`
  - `POST /v1/admin/assessments/:id/override`

This wave provides auth middleware and route protection primitives. Domain APIs are migrated in later waves.

## API Response Contract (Wave 4)

All endpoints return a single envelope:

```json
{
  "data": {},
  "error": null,
  "meta": {
    "requestId": "req_123",
    "timestamp": "2026-03-24T00:00:00.000Z"
  }
}
```

- Error responses return `data: null` with an `error` object.
- Request id is read from `X-Request-Id` if present; otherwise generated server-side.
- Response always includes `X-Request-Id`.

## Idempotency

- `POST /v1/documents` and `POST /v1/assessments` require `Idempotency-Key`.
- Reusing the same key with the same payload replays the previous response.
- Reusing the same key with a different payload returns `409 idempotency_conflict`.
- Duplicate in-flight requests return `409 idempotency_in_progress`.

## Auth0 JWT Verification

The worker verifies bearer JWTs using:

- Issuer: `AUTH_ISSUER_BASE_URL`
- Audience: `AUTH_AUDIENCE`
- Algorithms: `AUTH_JWT_ALGORITHMS` (default `RS256`)
- Role claim: `AUTH_ROLE_CLAIM` (default `https://fairlens.ai/roles`)
- Admin roles: `AUTH_ADMIN_ROLES` (default `admin`)

Optional local/test fallback: `AUTH_SHARED_SECRET` for HS256 token verification.

## Supabase Runtime Variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_REST_SCHEMA` (default `public`)
- `RISK_APPROVAL_THRESHOLD` (default `0.55`)
- `MODEL_VERSION` (default `worker-baseline-v1`)
- `IDEMPOTENCY_TTL_SECONDS` (default `86400`)
- `MODAL_EXTRACTION_ENDPOINT` (optional, enables dispatch during document creation)
- `MODAL_EXTRACTION_TOKEN` (optional bearer token for Modal endpoint)
- `EXTRACTION_CALLBACK_SECRET` (required for callback endpoint verification)

## Admin Assessment Filters

`GET /v1/admin/assessments` supports:

- `status` (`Approve|Decline`)
- `owner_sub`
- `reviewed_by` (partial match)
- `decision_source` (`auto|manual_override`)
- `q` (search over `owner_sub`, `reviewed_by`, `override_reason`)
- `page`, `limit`

## Local Development

```bash
cd worker-api
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

## Test

```bash
cd worker-api
npm test
```

## Deploy

```bash
cd worker-api
npm run deploy
```
