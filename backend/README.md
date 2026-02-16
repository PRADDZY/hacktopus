# FairLens Backend (FastAPI)

FastAPI service for BNPL risk prediction with PostgreSQL logging.

## Endpoints

- `POST /predict`
- `GET /stats`
- `GET /logs?page=<int>&limit=<int>`
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

- `DATABASE_URL` (Render PostgreSQL connection string)
- `CORS_ORIGINS` (comma-separated frontend origins)
- `MODEL_PATH` (optional)
- `MODEL_METADATA_PATH` (optional)

## Local Run

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 10000 --reload
```

## Render

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port 10000`
