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
- If a mutation fails with a server-side `5xx`, the in-progress key is released so clients can retry with the same key.

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
- `SUPABASE_JWKS_URL` (optional, defaults to `${SUPABASE_AUTH_ISSUER}/.well-known/jwks.json`)
- `SUPABASE_JWT_SECRET` (optional; used for HS256 fallback if provided)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_REST_SCHEMA` (default `public`)
- `CORS_ALLOWED_ORIGINS` (optional comma-separated allowlist; default `*`)
- `RISK_APPROVAL_THRESHOLD` (default `0.55`)
- `MODEL_VERSION` (default `worker-baseline-v1`)
- `WORKER_SCORING_FALLBACK_ENABLED` (default `false`; enable only for local/dev resiliency testing)
- `IDEMPOTENCY_TTL_SECONDS` (default `86400`)
- `MODEL_SCORING_ENDPOINT` (required in strict mode; points to ML `/predict`)
- `MODEL_SCORING_TOKEN` (optional bearer token for ML scoring endpoint)
- `FEATURE_EXTRACTION_ENDPOINT` (optional, points to ML `/featureize/statement`; defaults from `MODEL_SCORING_ENDPOINT` when available)
- `FEATURE_EXTRACTION_TOKEN` (optional bearer token for feature extraction endpoint, falls back to `MODEL_SCORING_TOKEN`)
- `MODAL_EXTRACTION_ENDPOINT` (optional, enables dispatch during document creation)
- `MODAL_EXTRACTION_TOKEN` (optional bearer token for Modal endpoint)
- `EXTRACTION_CALLBACK_SECRET` (required for callback endpoint verification)
- `AI_ASSISTANT_ENDPOINT` (optional remote assistant endpoint; fallback is worker rule-based assistant)
- `AI_ASSISTANT_TOKEN` (optional bearer token for remote assistant endpoint)

When strict scoring is active and ML scoring is unavailable, Worker returns `503 model_unavailable` for scoring routes.

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

## Demo-Ready Orchestration

Provision/update demo auth users, map admin/user roles, run deterministic seed, and verify critical demo APIs:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
SUPABASE_ANON_KEY=<anon-key> \
DEMO_ADMIN_EMAIL=<admin-email> \
DEMO_ADMIN_PASSWORD=<admin-password> \
DEMO_USER_EMAIL=<user-email> \
DEMO_USER_PASSWORD=<user-password> \
SMOKE_BASE_URL=https://<worker-url> \
npm run demo:ready
```

Optional flags:

- `--no-reset` keeps existing seeded rows.
- `--dry-run` prints planned actions only.
