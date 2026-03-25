# FairLens

Inclusive and explainable BNPL eligibility engine powered by cash-flow intelligence.

## System Overview

Frontend (Next.js)
- Unified app with shop and risk dashboard routes.

Backend (FastAPI)
- Orchestrates model inference, applies threshold, logs decisions to DB.

Worker API (Cloudflare, Wave 1 foundation)
- TypeScript runtime scaffold with Auth0 JWT verification and role guards.
- Wave 4 contract hardening: unified response envelope, request-id tracing, idempotent mutation routes.

ML Service (FastAPI)
- Serves the risk scoring contract (`risk-v2.0.0`) with explainability reasons.
- Supports CatBoost+FT ensemble artifacts and falls back to local baseline model artifacts.

Database
- PostgreSQL in production, SQLite by default for local dev.

Flow

Shop checkout -> Backend -> ML Service -> Risk probability -> Approve/Decline -> Logged -> Dashboard

## Run Locally

### 1) ML Service

```bash
cd ml-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 9000 --reload
```

### 2) Backend

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
NEXT_PUBLIC_BACKEND_URL=http://localhost:10000
NEXT_PUBLIC_AUTH0_DOMAIN=<tenant>.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=<client-id>
NEXT_PUBLIC_AUTH0_AUDIENCE=<api-audience>
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000
```

### 4) Worker API (optional in transition phase)

```bash
cd worker-api
npm install
npm run dev
```

## Key Endpoints

Backend
- `POST /predict`
- `POST /v1/applications`
- `GET /v1/applications/me`
- `GET /v1/admin/applications`
- `POST /v1/admin/applications/{application_uuid}/override`
- `GET /stats`
- `GET /logs`
- `GET /audit-logs`
- `GET /health`

ML Service
- `POST /predict`
- `GET /health`
- `GET /metadata`

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

Worker API
- `cd worker-api`
- `npm test` (in restricted sandboxes, use `npx tsc --noEmit` when process spawning is blocked)
- `npx tsc --noEmit`
