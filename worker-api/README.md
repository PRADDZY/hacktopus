# FairLens Worker API (Wave 1 Foundation)

Cloudflare Worker API scaffold for the migration from FastAPI runtime to Cloudflare fullstack.

## Current Scope

- Health endpoint: `GET /health`
- Auth context endpoint: `GET /auth/me`
- Guarded route examples:
  - `GET /v1/protected/user` (requires authenticated token when `AUTH_REQUIRED=true`)
  - `GET /v1/protected/admin` (requires admin role)
- Domain foundation endpoints:
  - `POST /v1/assistant/query`
  - `POST /v1/applications`
  - `GET /v1/applications/me`
  - `GET /v1/admin/applications`
  - `GET /v1/admin/applications/:applicationUuid`
  - `POST /v1/admin/applications/:applicationUuid/override`
  - `GET /v1/stats`
  - `GET /v1/logs`
  - `GET /v1/audit-logs`
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

- `POST /v1/applications` supports optional idempotency with `Idempotency-Key`.
- `POST /v1/documents` and `POST /v1/assessments` require `Idempotency-Key`.
- Reusing the same key with the same payload replays the previous response.
- Reusing the same key with a different payload returns `409 idempotency_conflict`.
- Duplicate in-flight requests return `409 idempotency_in_progress`.

## JWT Verification (Supabase-First)

The worker verifies bearer JWTs using Supabase config when present:

- Issuer: `SUPABASE_AUTH_ISSUER` (or `${SUPABASE_URL}/auth/v1`)
- Audience: `AUTH_AUDIENCE` (default `authenticated`)
- JWT secret: `SUPABASE_JWT_SECRET`
- Role claim: `AUTH_ROLE_CLAIM` (default `https://fairlens.ai/roles`)
- Admin roles: `AUTH_ADMIN_ROLES` (default `admin`)

For Supabase mode, admin role is resolved from `public.user_roles` using `SUPABASE_SERVICE_ROLE_KEY`.

Auth0/JWKS mode remains available as fallback via:

- `AUTH_ISSUER_BASE_URL`
- `AUTH_AUDIENCE`
- `AUTH_JWKS_URL` (or inferred from issuer)
- Optional `AUTH_SHARED_SECRET` for local HS256 test tokens.

## Supabase Runtime Variables

- `SUPABASE_URL`
- `SUPABASE_AUTH_ISSUER` (optional, defaults to `${SUPABASE_URL}/auth/v1`)
- `SUPABASE_JWT_SECRET` (required for Supabase JWT verification mode)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_REST_SCHEMA` (default `public`)
- `RISK_APPROVAL_THRESHOLD` (default `0.55`)
- `MODEL_VERSION` (default `worker-baseline-v1`)
- `IDEMPOTENCY_TTL_SECONDS` (default `86400`)
- `MODEL_SCORING_ENDPOINT` (optional, points to ML `/predict`; if absent worker uses local fallback heuristic)
- `MODEL_SCORING_TOKEN` (optional bearer token for ML scoring endpoint)
- `FEATURE_EXTRACTION_ENDPOINT` (optional, points to ML `/featureize/statement`; defaults from `MODEL_SCORING_ENDPOINT` when available)
- `FEATURE_EXTRACTION_TOKEN` (optional bearer token for feature extraction endpoint, falls back to `MODEL_SCORING_TOKEN`)
- `MODAL_EXTRACTION_ENDPOINT` (optional, enables dispatch during document creation)
- `MODAL_EXTRACTION_TOKEN` (optional bearer token for Modal endpoint)
- `EXTRACTION_CALLBACK_SECRET` (required for callback endpoint verification)
- `AI_ASSISTANT_ENDPOINT` (optional remote assistant endpoint; fallback is worker rule-based assistant)
- `AI_ASSISTANT_TOKEN` (optional bearer token for remote assistant endpoint)

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

## Demo Smoke

```bash
cd worker-api
npm run smoke
```

With auth/admin checks:

```bash
SMOKE_BASE_URL=https://<worker-url> \
SMOKE_BEARER_TOKEN=<jwt> \
SMOKE_CHECK_ADMIN=true \
npm run smoke
```

## Demo Seed Data

Seed deterministic dashboard applications + audit logs into Supabase:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
npm run seed:demo
```

Optional role mappings (if you already know auth user UUIDs):

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
DEMO_ADMIN_USER_ID=<admin-user-uuid> \
DEMO_USER_USER_ID=<user-user-uuid> \
npm run seed:demo
```
