# FairLens Backend (FastAPI)

Orchestrates BNPL risk predictions. Calls the ML service, applies the decision threshold, and logs outcomes to the database.

## Endpoints

- `POST /predict`
- `GET /stats`
- `GET /logs?page=<int>&limit=<int>`
- `GET /audit-logs?page=<int>&limit=<int>&status=<optional>&search=<optional>`
- `GET /health`

## Request Contract

`POST /predict` body:

```json
{
  "avg_monthly_inflow": 100000,
  "inflow_volatility": 0.2,
  "avg_monthly_outflow": 60000,
  "min_balance_30d": 15000,
  "neg_balance_days_30d": 0,
  "purchase_to_inflow_ratio": 0.3,
  "total_burden_ratio": 0.45,
  "buffer_ratio": 0.25,
  "stress_index": 0.2
}
```

Response:

```json
{
  "risk_probability": 0.216425,
  "decision": "Approve"
}
```

## Environment Variables

- `DATABASE_URL` (PostgreSQL connection string; defaults to SQLite)
- `CORS_ORIGINS` (comma-separated frontend origins)
- `ML_SERVICE_URL` (default `http://localhost:9000`)
- `ML_SERVICE_TIMEOUT` (seconds, default `3.5`)
- `MODEL_PATH` (optional local model override)
- `MODEL_METADATA_PATH` (optional local metadata override)

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
