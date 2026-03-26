# FairLens

Inclusive and explainable BNPL eligibility engine powered by cash-flow intelligence.

## System Overview

Frontend (Next.js)
- Unified app with shop and risk dashboard routes.

Backend (FastAPI)
- Legacy compatibility service retained for fallback/testing.

Worker API (Cloudflare, Wave 1 foundation)
- Primary runtime API for checkout/admin domain, auth guardrails, and assistant endpoint.
- Strict scoring mode is default; heuristic fallback is opt-in via `WORKER_SCORING_FALLBACK_ENABLED=true`.

ML Service (FastAPI)
- Serves the risk scoring contract (`risk-v2.0.0`) with explainability reasons.
- Supports dual-target and ensemble artifact bundles with explicit runtime mode selection.
- Legacy JSON fallback is opt-in via `ML_LEGACY_JSON_FALLBACK_ENABLED=true`.

Database
- Supabase Postgres for application, extraction, and audit domain data.

Flow

Shop checkout -> Worker `/v1/documents` + `/v1/assessments` -> ML Service -> Risk probability -> Approve/Decline -> Logged -> Dashboard

Checkout scoring uses real statement evidence only (parsed CSV transactions or completed extraction artifacts).

## Run Locally

### 1) ML Service

```bash
cd ml-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 9000 --reload
```

Environment variables (ml-service):

```
MODEL_RUNTIME_MODE=auto
MODEL_PATH=./bnpl_cashflow_model.pkl
MODEL_METADATA_PATH=./model_metadata.json
MODEL_ARTIFACT_DIR=<optional-artifacts-dir>
ML_LEGACY_JSON_FALLBACK_ENABLED=false
```

### 2) Backend (optional legacy mode)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 10000 --reload
```

Environment variables (backend/.env.example):

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
CORS_ORIGINS=http://localhost:3000
ML_SERVICE_URL=http://localhost:9000
ML_SERVICE_TIMEOUT=3.5
```

If the ML service is unavailable, the backend falls back to the local model files in `backend/model`.

### 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

Environment variables (frontend/.env.example):

```
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000
```

Supabase auth is required for login/signup/admin route access.

### 4) Worker API (primary runtime)

```bash
cd worker-api
npm install
npm run dev
```

## Key Endpoints

Worker API (primary app domain)
- `POST /v1/assistant/query`
- `POST /v1/applications`
- `GET /v1/applications/me`
- `GET /v1/admin/applications`
- `GET /v1/admin/applications/{application_uuid}`
- `POST /v1/admin/applications/{application_uuid}/override`
- `GET /v1/stats`
- `GET /v1/logs`
- `GET /v1/audit-logs`
- `POST /v1/documents`
- `POST /v1/assessments`
- `GET /health`

Backend (legacy / compatibility)
- `POST /predict`
- `GET /health`

ML Service
- `POST /predict`
- `GET /health`
- `GET /metadata`

## Demo Operations

- Demo runbook: [docs/demo/demo-runbook.md](docs/demo/demo-runbook.md)
- Worker smoke check:

```bash
cd worker-api
npm run smoke
```

- Optional deterministic demo seed (Supabase):

```bash
cd worker-api
SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service-role-key> npm run seed:demo
```

## Project Structure

```
backend/        FastAPI API + DB logging
worker-api/     Cloudflare Worker API scaffold + auth middleware
ml-service/     ML inference service (model artifacts + API)
frontend/       Unified Next.js app (shop + dashboard)
legacy/         Previous iterations kept for reference
shared/         OpenAPI schema for shared contracts
```

## Shared Types

Export OpenAPI and generate frontend types:

```bash
python backend/scripts/export_openapi.py
cd frontend
npm run types:generate
```

## Tests

Backend
- `cd backend`
- `python -m pytest`
- `python -m pytest tests/integration`

ML Service
- `cd ml-service`
- `python -m pytest`

Frontend
- `cd frontend`
- `npm run lint`
- `npm run test`
- `npm run test:e2e` (first run may require `npx playwright install`)

Auth Notes
- Supabase auth is primary for user/admin sign-in.
- Passkey (WebAuthn) enrollment and verification is available from frontend profile page for authenticated Supabase users.

Worker API
- `cd worker-api`
- `npm test` (in restricted sandboxes, use `npx tsc --noEmit` when process spawning is blocked)
- `npx tsc --noEmit`
