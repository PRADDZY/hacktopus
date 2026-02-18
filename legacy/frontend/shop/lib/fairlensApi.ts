export interface FairlensPredictRequest {
  avg_monthly_inflow: number;
  inflow_volatility: number;
  avg_monthly_outflow: number;
  min_balance_30d: number;
  neg_balance_days_30d: number;
  purchase_to_inflow_ratio: number;
  total_burden_ratio: number;
  buffer_ratio: number;
  stress_index: number;
}

export interface FairlensPredictResponse {
  risk_probability: number;
  decision: 'Approve' | 'Decline';
}

const backendBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '') ?? 'http://localhost:10000';

export async function predictBNPLRisk(
  payload: FairlensPredictRequest
): Promise<FairlensPredictResponse> {
  const response = await fetch(`${backendBaseUrl}/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Prediction failed with status ${response.status}`);
  }

  return (await response.json()) as FairlensPredictResponse;
}
