# Backend API - FinTech Risk Bridge

FastAPI backend service that connects the frontend to the ML model for EMI risk prediction.

## Architecture

```
Frontend ↔ Backend (FastAPI) ↔ ML Service
```

## Setup

### 1. Create Virtual Environment

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env and set ML_SERVICE_URL to your ML service endpoint
```

### 4. Run the Server

```bash
# Development mode with auto-reload
python run.py

# Or using uvicorn directly
uvicorn run:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- API: http://localhost:8000
- Interactive Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### Core Endpoints

#### `POST /api/v1/predict`
Main prediction endpoint for EMI risk assessment.

**Request Body:**
```json
{
  "buyer_id": "BUYER123",
  "product_id": "PROD456",
  "purchase_amount": 50000,
  "emi_tenure_months": 12,
  "monthly_income": 60000,
  "existing_emi_amount": 5000,
  "fixed_expenses": 20000,
  "savings_buffer": 100000,
  "age": 28
}
```

**Response:**
```json
{
  "risk_score": 0.35,
  "risk_category": "Moderate",
  "debt_trap_probability": 25.5,
  "financial_health_score": 72.3,
  "decision": "Approve with Warning",
  "requires_double_confirmation": true,
  "warning_message": "Moderate risk detected",
  "recommendation": "Proceed with caution",
  "dti_ratio": 0.38,
  "foir": 0.45,
  "proposed_monthly_emi": 4500,
  "disposable_income": 25000,
  "key_factors": {
    "dti_ratio": 0.35,
    "foir": 0.30
  },
  "prediction_id": "PRED_20250217_ABC123",
  "timestamp": "2025-02-17T10:30:00Z"
}
```

### Lender Dashboard Endpoints

#### `GET /api/v1/lender/applications?limit=50`
Get recent EMI applications for lender dashboard.

#### `GET /api/v1/lender/statistics?days=7`
Get aggregate statistics (approval rate, rejection rate, etc.).

#### `GET /api/v1/lender/fairness-metrics`
Calculate fairness metrics across demographic groups.

#### `GET /api/v1/lender/drift-check`
Check for model drift.

### Health Check

#### `GET /` or `GET /health`
Check API health and ML service connection status.

## Database

The backend uses SQLite by default to store prediction logs. The database is created automatically on first run.

**Schema:**
- `prediction_logs`: Stores all EMI risk predictions with buyer info, metrics, and decisions

## ML Service Integration

The backend connects to the ML service via three methods:

1. **Async HTTP (Recommended)**: `ml_connector.predict(request)`
2. **Sync HTTP**: `ml_connector.predict_sync(request)`
3. **Local Function**: `ml_connector.predict_local(request)` - for direct Python imports

Configure the ML service URL in `.env`:
```
ML_SERVICE_URL=http://localhost:5000
```

**Expected ML Service Endpoints:**
- `POST /predict` - Risk prediction
- `GET /health` - Health check

## Project Structure

```
backend/
├── config.py              # Configuration settings
├── run.py                 # Main FastAPI application
├── main.py                # Entry point
├── requirements.txt       # Python dependencies
├── .env.example          # Environment template
├── database/
│   ├── db.py             # Database models
│   └── crud.py           # Database operations
├── models/
│   ├── schemas.py        # Pydantic models
│   └── ml_connector.py   # ML service connector
└── middleware/
    └── validators.py     # Input validation & metrics
```

## Key Metrics Calculated

- **DTI Ratio**: Debt-to-Income ratio
- **FOIR**: Fixed Obligations to Income Ratio
- **Savings Months**: Available savings as months of income
- **Financial Health Score**: Overall financial health (0-100)
- **Debt Trap Probability**: Risk of falling into debt trap (0-100%)

## Development

### Running Tests
```bash
# TODO: Add tests
pytest
```

### Code Style
```bash
# Format code
black .

# Check types
mypy .
```

## Troubleshooting

### ML Service Connection Issues
- Check that ML_SERVICE_URL is correct in `.env`
- Verify ML service is running
- Check ML service logs for errors

### Database Issues
- Delete `fintech_risk.db` to reset the database
- Check file permissions

### CORS Issues
- Update `BACKEND_CORS_ORIGINS` in `config.py` or `.env`
- Add your frontend URL to the allowed origins

## License

[Add your license here]
