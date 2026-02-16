# FairLens BNPL Responsible AI Project

Integrated full-stack setup:

- `backend/` -> FastAPI + SQLAlchemy + BNPL model inference
- `frontend/shop/` -> Shop checkout UI (`POST /predict` integration)
- `frontend/dashboard/` -> Admin analytics dashboard (`GET /stats`, `GET /logs`)

## Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 10000 --reload
```

Set:

- `DATABASE_URL` for PostgreSQL
- `CORS_ORIGINS` for frontend domains

## Shop Frontend

```bash
cd frontend/shop
npm install
npm run dev
```

Set `NEXT_PUBLIC_BACKEND_URL` (see `.env.example`).

## Dashboard Frontend

```bash
cd frontend/dashboard
npm install
npm run dev
```

Set `NEXT_PUBLIC_BACKEND_URL` (see `.env.example`).
