# Cloudflare + Modal Deployment (CLI + Authenticated Sessions)

This runbook assumes you are authenticated via CLI/MCP and are **not** reading tokens from local files.

## 0) Cloudflare account prerequisite (one-time)

Cloudflare Workers deploy requires a registered `workers.dev` subdomain in your account.

Complete once in dashboard:

`https://dash.cloudflare.com/<account-id>/workers/onboarding`

## 1) Verify CLI sessions

```powershell
# Cloudflare
npm exec --prefix worker-api wrangler whoami

# Modal
modal profile list

# Supabase
supabase projects list
```

## 2) Supabase schema (once per environment)

```powershell
supabase link --project-ref <project-ref>
supabase db push
```

This applies migrations from `supabase/migrations`.

## 3) Deploy ML service to Modal

```powershell
cd ml-service
modal deploy modal_app.py
```

After deploy, note the public base URL and verify:

```powershell
curl <modal-base-url>/health
curl <modal-base-url>/metadata
```

## 4) Deploy API worker to Cloudflare

From `worker-api/`, set required runtime secrets:

```powershell
npm install
npm exec wrangler secret put SUPABASE_JWT_SECRET
npm exec wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npm exec wrangler secret put EXTRACTION_CALLBACK_SECRET
```

Optional secrets:

```powershell
npm exec wrangler secret put MODEL_SCORING_TOKEN
npm exec wrangler secret put FEATURE_EXTRACTION_TOKEN
npm exec wrangler secret put MODAL_EXTRACTION_TOKEN
npm exec wrangler secret put AI_ASSISTANT_TOKEN
```

Deploy:

```powershell
npm run deploy
```

Set worker vars in `worker-api/wrangler.toml` before deploy:
- `MODEL_SCORING_ENDPOINT=<modal-base-url>/predict`
- `FEATURE_EXTRACTION_ENDPOINT=<modal-base-url>/featureize/statement`
- `MODAL_EXTRACTION_ENDPOINT=<modal-base-url>/extract`
- `SUPABASE_URL=https://<project-ref>.supabase.co`

## 5) Deploy frontend to Cloudflare (OpenNext)

From `frontend/`, set build-time public env vars in the current shell:

```powershell
$env:NEXT_PUBLIC_API_URL="https://<worker-domain>"
$env:NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"
$env:NEXT_PUBLIC_APP_BASE_URL="https://<frontend-domain>"

npm install
npm run cf:deploy
```

`cf:deploy` now:
- builds OpenNext bundle
- applies a Windows runtime patch to generated handler
- syncs `.dev.vars` into Worker secrets (includes `NEXTJS_ENV`)
- runs Wrangler deploy

## 6) Post-deploy smoke checks

```powershell
cd worker-api
npm run smoke
```

Authenticated smoke (recommended for demo readiness):

```powershell
$env:SMOKE_BASE_URL="https://<worker-domain>"
$env:SMOKE_BEARER_TOKEN="<jwt>"
$env:SMOKE_CHECK_ADMIN="true"
npm run smoke
```

## 7) Demo data seed (optional but recommended)

```powershell
cd worker-api
$env:SUPABASE_URL="https://<project-ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
npm run seed:demo
```
