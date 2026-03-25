# FairLens Backend (FastAPI)

Orchestrates BNPL risk predictions. Calls the ML service, applies the decision threshold, and logs outcomes to the database.

## Endpoints

- `GET /auth/me`
- `POST /predict`
- `POST /v1/applications`
- `GET /v1/applications/me`
- `GET /v1/admin/applications`
- `GET /v1/admin/applications/{application_uuid}`
- `POST /v1/admin/applications/{application_uuid}/override`
- `GET /stats`
- `GET /logs?page=<int>&limit=<int>`
- `GET /audit-logs?page=<int>&limit=<int>&status=<optional>&search=<optional>`
- `GET /health`

## Route Access

- `GET /auth/me` is public and returns current auth context if bearer token is present.
- `POST /predict` requires authentication when `AUTH_REQUIRED=true`.
- `POST /v1/applications` and `GET /v1/applications/me` require authenticated user context.
- `/v1/admin/*` routes require `admin` role when `AUTH_REQUIRED=true`.
- `GET /stats`, `GET /logs`, and `GET /audit-logs` require `admin` role when `AUTH_REQUIRED=true`.
- If auth env vars are not configured, `AUTH_REQUIRED` defaults to `false` for local development.

## Request Contract

`POST /predict` body:

```json
{
  "segment": "gig_worker",
  "monthly_inflow": 100000,
  "monthly_outflow": 60000,
  "inflow_volatility_90d": 0.2,
  "outflow_volatility_90d": 0.24,
  "deposit_count_30d": 6,
  "days_since_last_income": 2,
  "avg_balance_30d": 22000,
  "min_balance_30d": 15000,
  "negative_balance_days_30d": 0,
  "essential_spend_ratio": 0.61,
  "active_loan_count": 1,
  "monthly_installment_burden": 8500,
  "purchase_amount": 30000,
  "tenure_weeks": 24,
  "purchase_to_inflow_ratio": 0.3,
  "installment_to_inflow_ratio": 0.085,
  "total_burden_ratio": 0.45,
  "buffer_ratio": 0.25,
  "stress_index": 0.2
}
```

Response:

```json
{
  "risk_probability": 0.216425,
  "decision": "Approve",
  "model_version": "ensemble-catboost-ft-v1",
  "schema_version": "risk-v2.0.0",
  "calibration_bucket": "low",
  "reasons": [
    {
      "code": "BUFFER_STRENGTH",
      "feature": "buffer_ratio",
      "direction": "down",
      "impact": 0.09,
      "message": "Healthy liquidity buffer lowers near-term repayment risk."
    }
  ]
}
```

## Environment Variables

- `DATABASE_URL` (PostgreSQL connection string; defaults to SQLite)
- `CORS_ORIGINS` (comma-separated frontend origins)
- `ML_SERVICE_URL` (default `http://localhost:9000`)
- `ML_SERVICE_TIMEOUT` (seconds, default `3.5`)
- `MODEL_PATH` (optional local model override)
- `MODEL_METADATA_PATH` (optional local metadata override)
- `AUTH_ISSUER_BASE_URL` or `AUTH0_ISSUER_BASE_URL` (token issuer)
- `AUTH_AUDIENCE` or `AUTH0_AUDIENCE` (API audience)
- `AUTH_REQUIRED` (`true` or `false`; defaults to `true` only when issuer+audience exist)
- `AUTH_ROLE_CLAIM` (default `https://fairlens.ai/roles`)
- `AUTH_ADMIN_ROLES` (comma-separated, default `admin`)
- `AUTH_JWT_ALGORITHMS` (comma-separated, default `RS256`)
- `AUTH_JWKS_URL` (optional override; defaults to `<issuer>/.well-known/jwks.json`)
- `AUTH_SHARED_SECRET` (optional local/test secret for HS256 tokens)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (for Supabase integration)

Supabase migration baseline is in `backend/supabase/migrations`.

## Local Run

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 10000 --reload
```

If the ML service is unavailable, the backend falls back to the local model files in `backend/model`.

## Shared Types

Export the OpenAPI schema for shared contracts:

```bash
python scripts/export_openapi.py
```
