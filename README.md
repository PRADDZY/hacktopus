# FairLens

### Inclusive & Explainable BNPL Eligibility Engine

FairLens is an AI-powered BNPL (Buy Now Pay Later) eligibility engine
designed to enable responsible lending for gig workers, freelancers,
students, and credit-invisible users --- without relying on traditional
credit scores or salary slips.

Instead of historical credit data, FairLens evaluates real cash-flow
sustainability to determine repayment ability in real time.

------------------------------------------------------------------------

## 🚨 Problem Statement

Millions of gig workers and informal earners lack traditional credit
history, leading to financial exclusion or irresponsible BNPL approvals
that increase default risk.

Current BNPL systems: - Depend heavily on credit scores - Ignore income
volatility - Lack transparency - Encourage overspending without deep
affordability checks

There is a need for a real-time, explainable, cash-flow-based
eligibility system.

------------------------------------------------------------------------

## 💡 Our Approach

FairLens replaces traditional credit scoring with a cash-flow
intelligence model that evaluates:

-   Income stability
-   Spending burden
-   Liquidity buffer
-   Purchase affordability
-   Repayment stress

The system:

1.  Accepts financial indicators (or Excel-based feature uploads)
2.  Uses a calibrated XGBoost model to compute risk probability
3.  Applies a binary decision threshold (0.55)
4.  Returns Approve / Decline instantly
5.  Logs all decisions for portfolio monitoring

Model performance: \~0.85 ROC-AUC on structured synthetic gig-economy
cash-flow data.

------------------------------------------------------------------------

## 🧠 Machine Learning Methodology

Model: - XGBoost classifier - Probability calibration (Isotonic) -
Binary threshold: 0.55

Key Engineered Features: - purchase_to_inflow_ratio -
total_burden_ratio - buffer_ratio - inflow_volatility - stress_index -
neg_balance_days_30d

Explainability: - SHAP (SHapley Additive Explanations) - Per-user risk
contribution analysis

The model focuses on sustainability instead of historical credit
behavior.

------------------------------------------------------------------------

## 🏗 System Architecture

Frontend (Next.js + Tailwind) - Shop (BNPL checkout simulation) - Admin
Dashboard (analytics & monitoring)

Backend (FastAPI) - REST API endpoints - ML model inference - PostgreSQL
logging - CORS-enabled

Database (PostgreSQL) - Stores all eligibility requests - Tracks risk
scores - Enables analytics & dashboard metrics

Deployment - Hosted on Render - GitHub auto-deploy enabled - Backend +
Static frontend + Managed PostgreSQL

------------------------------------------------------------------------

## 📊 High-Level Flow

User → Checkout → Upload Financial Data\
→ FastAPI Backend → XGBoost Model\
→ Risk Probability → Approve / Decline\
→ Log to PostgreSQL\
→ Admin Dashboard Analytics

------------------------------------------------------------------------

## 📂 Project Structure

    fairlens/
    │
    ├── frontend/
    │   ├── shop/
    │   └── dashboard/
    │
    ├── backend/
    │   ├── main.py
    │   ├── model/
    │   │   ├── bnpl_cashflow_model.pkl
    │   │   └── model_metadata.json
    │   ├── database.py
    │   ├── models.py
    │   ├── schemas.py
    │   └── requirements.txt
    │
    └── FairLens_Final_Model_Training.ipynb

------------------------------------------------------------------------

## 🚀 Running Locally

### Backend

    cd backend
    python -m venv venv
    source venv/bin/activate   # macOS/Linux
    venv\Scripts\activate    # Windows
    pip install -r requirements.txt
    uvicorn main:app --reload

### Frontend

    cd frontend
    npm install
    npm run dev

Set environment variable:

    NEXT_PUBLIC_API_URL=http://localhost:8000

------------------------------------------------------------------------

## 📚 References

-   XGBoost: https://xgboost.ai\
-   SHAP: https://github.com/slundberg/shap\
-   FastAPI: https://fastapi.tiangolo.com\
-   Next.js: https://nextjs.org\
-   Render: https://render.com

------------------------------------------------------------------------

## 🏆 Impact

FairLens enables:

-   Financial inclusion for credit-invisible users
-   Responsible BNPL approvals
-   Reduced default risk
-   Transparent AI underwriting
-   Real-time checkout decisions

------------------------------------------------------------------------

## 🔮 Future Improvements

-   Real bank statement API integration
-   Dynamic threshold tuning
-   Fairness auditing metrics
-   Fraud detection integration
-   Real-world dataset training

------------------------------------------------------------------------

## 📌 Summary

FairLens is an explainable AI-powered BNPL eligibility engine that
evaluates repayment sustainability using cash-flow intelligence instead
of traditional credit scores.
