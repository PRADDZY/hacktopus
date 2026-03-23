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
  - `POST /v1/assessments`
  - `GET /v1/assessments/me`
  - `GET /v1/admin/assessments`
  - `POST /v1/admin/assessments/:id/override`

This wave provides auth middleware and route protection primitives. Domain APIs are migrated in later waves.

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
