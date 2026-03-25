# FairLens Demo Runbook

## 1) Pre-Demo Checklist

- Frontend deployed and reachable (`Cloudflare Pages` or equivalent public URL).
- Worker API deployed and reachable (`Cloudflare Workers` URL).
- Supabase project active with migrations applied (`0001` to `0004`).
- ML service reachable from Worker (`MODEL_SCORING_ENDPOINT` and `FEATURE_EXTRACTION_ENDPOINT`).
- Optional remote assistant endpoint configured (`AI_ASSISTANT_ENDPOINT`) or fallback mode accepted.
- At least one admin user mapped in `public.user_roles` with `role='admin'`.

## 2) Required Environment Matrix

### Frontend

- `NEXT_PUBLIC_API_URL` -> Worker base URL
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_BASE_URL` -> frontend public URL

### Worker

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `AUTH_AUDIENCE=authenticated`
- `MODEL_SCORING_ENDPOINT`
- `FEATURE_EXTRACTION_ENDPOINT` (optional if derived)
- `EXTRACTION_CALLBACK_SECRET`
- Optional:
  - `AI_ASSISTANT_ENDPOINT`
  - `AI_ASSISTANT_TOKEN`
  - `MODAL_EXTRACTION_ENDPOINT`
  - `MODAL_EXTRACTION_TOKEN`

## 3) Smoke Validation Before Demo

From `worker-api/`:

```bash
npm run smoke
```

With authenticated checks:

```bash
SMOKE_BASE_URL=https://<worker-url> \
SMOKE_BEARER_TOKEN=<jwt> \
SMOKE_CHECK_ADMIN=true \
npm run smoke
```

What this verifies:

- `/health`
- `/v1/assistant/query`
- `/auth/me`
- authenticated `/v1/applications/me` (if token provided)
- admin `/v1/stats` (if enabled)

## 3.5) Deterministic Demo Seed (Recommended)

From `worker-api/`:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
npm run seed:demo
```

Optional role mapping when you know user UUIDs from Supabase Auth:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
DEMO_ADMIN_USER_ID=<admin-user-uuid> \
DEMO_USER_USER_ID=<user-user-uuid> \
npm run seed:demo
```

## 4) Demo Script (Judge Flow)

1. User signup/login (Supabase auth).
2. (Optional) Profile -> register passkey and verify factor.
3. Shop -> add product -> checkout.
4. Upload statement and run EMI eligibility.
5. Show assessment decision + risk percentage.
6. Place order and show order history.
7. Admin login -> dashboard -> review logs/requests.
8. Trigger assistant widget question and show guidance.

## 5) Live Fallback Plan

- If remote AI assistant is down: Worker serves rule-based assistant automatically.
- If statement extraction callback is delayed: assessment still works with statement payload featureization path.
- If one browser session is stale: use fresh incognito for admin/user route separation.
- Keep one pre-approved demo account and one borderline account for deterministic storytelling.
