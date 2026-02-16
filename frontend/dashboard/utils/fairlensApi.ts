import { BackendLogItem, BackendLogsResponse, BackendStats, EMIRequest } from '../types';

const apiBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '') ?? 'http://localhost:10000';
const useFakeDashboardData = (process.env.NEXT_PUBLIC_USE_FAKE_DASHBOARD ?? 'true') === 'true';

const demoLogs: BackendLogItem[] = [
  {
    id: 1001,
    avg_monthly_inflow: 120000,
    inflow_volatility: 0.16,
    avg_monthly_outflow: 62000,
    min_balance_30d: 22000,
    neg_balance_days_30d: 0,
    purchase_to_inflow_ratio: 0.24,
    total_burden_ratio: 0.41,
    buffer_ratio: 0.19,
    stress_index: 0.29,
    risk_probability: 0.12,
    decision: 'Approve',
    created_at: '2026-02-16T12:20:00Z',
  },
  {
    id: 1002,
    avg_monthly_inflow: 58000,
    inflow_volatility: 0.34,
    avg_monthly_outflow: 49000,
    min_balance_30d: 2000,
    neg_balance_days_30d: 7,
    purchase_to_inflow_ratio: 0.64,
    total_burden_ratio: 0.82,
    buffer_ratio: 0.03,
    stress_index: 0.74,
    risk_probability: 0.89,
    decision: 'Decline',
    created_at: '2026-02-16T12:23:00Z',
  },
  {
    id: 1003,
    avg_monthly_inflow: 95000,
    inflow_volatility: 0.19,
    avg_monthly_outflow: 52000,
    min_balance_30d: 18000,
    neg_balance_days_30d: 1,
    purchase_to_inflow_ratio: 0.31,
    total_burden_ratio: 0.48,
    buffer_ratio: 0.18,
    stress_index: 0.36,
    risk_probability: 0.28,
    decision: 'Approve',
    created_at: '2026-02-16T12:30:00Z',
  },
  {
    id: 1004,
    avg_monthly_inflow: 67000,
    inflow_volatility: 0.27,
    avg_monthly_outflow: 50000,
    min_balance_30d: 5500,
    neg_balance_days_30d: 3,
    purchase_to_inflow_ratio: 0.46,
    total_burden_ratio: 0.66,
    buffer_ratio: 0.08,
    stress_index: 0.55,
    risk_probability: 0.61,
    decision: 'Decline',
    created_at: '2026-02-16T12:40:00Z',
  },
  {
    id: 1005,
    avg_monthly_inflow: 130000,
    inflow_volatility: 0.14,
    avg_monthly_outflow: 70000,
    min_balance_30d: 26000,
    neg_balance_days_30d: 0,
    purchase_to_inflow_ratio: 0.22,
    total_burden_ratio: 0.39,
    buffer_ratio: 0.2,
    stress_index: 0.24,
    risk_probability: 0.18,
    decision: 'Approve',
    created_at: '2026-02-16T12:55:00Z',
  },
];

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const toPercent = (value: number): number => Math.round(clamp(value, 0, 1) * 100);

const toStatus = (decision: 'Approve' | 'Decline'): EMIRequest['status'] =>
  decision === 'Approve' ? 'Approved' : 'Rejected';

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

const buildDemoStats = (): BackendStats => {
  const total = demoLogs.length;
  const approved = demoLogs.filter((log) => log.decision === 'Approve').length;
  const declined = total - approved;
  const low = demoLogs.filter((log) => log.risk_probability < 0.33).length;
  const medium = demoLogs.filter((log) => log.risk_probability >= 0.33 && log.risk_probability < 0.66).length;
  const high = demoLogs.filter((log) => log.risk_probability >= 0.66).length;

  return {
    total_predictions: total,
    approval_rate: approved / total,
    decline_rate: declined / total,
    risk_score_distribution: {
      low,
      medium,
      high,
    },
  };
};

export async function fetchStats(): Promise<BackendStats> {
  if (useFakeDashboardData) {
    return buildDemoStats();
  }

  const response = await fetch(`${apiBaseUrl}/stats`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as BackendStats;
}

export async function fetchLogs(page = 1, limit = 20): Promise<BackendLogsResponse> {
  if (useFakeDashboardData) {
    return {
      page,
      limit,
      total: demoLogs.length,
      total_pages: 1,
      items: demoLogs.slice(0, limit),
    };
  }

  const response = await fetch(`${apiBaseUrl}/logs?page=${page}&limit=${limit}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as BackendLogsResponse;
}
