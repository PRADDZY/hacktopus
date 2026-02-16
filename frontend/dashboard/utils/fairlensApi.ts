import { BackendLogItem, BackendLogsResponse, BackendStats, EMIRequest } from '@/types';

const apiBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '') ?? 'http://localhost:10000';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const toPercent = (value: number): number => Math.round(clamp(value, 0, 1) * 100);

const toStatus = (decision: 'Approve' | 'Decline') => (decision === 'Approve' ? 'Approved' : 'Rejected') as const;

export const mapLogToEMIRequest = (item: BackendLogItem): EMIRequest => {
  const riskScore = toPercent(item.risk_probability);
  const creditScore = clamp(Math.round(850 - item.risk_probability * 350), 300, 850);
  const dti = Math.round(clamp(item.total_burden_ratio, 0, 1) * 100);
  const estimatedPurchaseAmount = Math.max(0, item.avg_monthly_inflow * item.purchase_to_inflow_ratio);
  const emiAmount = Math.round(estimatedPurchaseAmount / 6);
  const existingEmis = Math.round(item.avg_monthly_outflow * 0.3);

  const creditScoreWeight = clamp(Math.round((1 - item.risk_probability) * 35), 5, 35);
  const dtiWeight = clamp(Math.round(item.total_burden_ratio * 30), 5, 30);
  const emiLoad = clamp(Math.round(item.purchase_to_inflow_ratio * 20), 5, 20);
  const savingsWeight = clamp(Math.round((1 - clamp(item.buffer_ratio, 0, 1)) * 10), 5, 10);
  const stabilityScore = clamp(100 - (creditScoreWeight + dtiWeight + emiLoad + savingsWeight), 10, 80);

  return {
    id: `TXN-${item.id}`,
    buyerId: `BUY-${String(item.id).padStart(5, '0')}`,
    buyerName: `Applicant ${item.id}`,
    creditScore,
    dti,
    riskScore,
    debtProbability: riskScore,
    emiAmount,
    productCategory: 'Retail Purchase',
    status: toStatus(item.decision),
    monthlyIncome: Math.round(item.avg_monthly_inflow),
    existingEmis,
    fixedExpenses: Math.round(item.avg_monthly_outflow),
    savingsBuffer: Math.round(item.min_balance_30d),
    creditScoreWeight,
    dtiWeight,
    emiLoad,
    savingsWeight,
    stabilityScore,
    riskProbability: item.risk_probability,
    createdAt: item.created_at,
  };
};

const parseError = async (response: Response): Promise<string> => {
  try {
    const data = await response.json();
    return data?.detail ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
};

export async function fetchStats(): Promise<BackendStats> {
  const response = await fetch(`${apiBaseUrl}/stats`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as BackendStats;
}

export async function fetchLogs(page = 1, limit = 20): Promise<BackendLogsResponse> {
  const response = await fetch(`${apiBaseUrl}/logs?page=${page}&limit=${limit}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as BackendLogsResponse;
}
