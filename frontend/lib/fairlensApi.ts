import {
  AuditLogItem,
  BackendAuditLogsResponse,
  BackendLogItem,
  BackendLogsResponse,
  BackendStats,
  EMIRequest,
  FairlensPredictRequest,
  FairlensPredictResponse,
} from '@/types';
import { DashboardMode, getDashboardMode } from '@/lib/dashboardMode';

const backendBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '') ?? 'http://localhost:10000';

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

const demoAuditLogs: AuditLogItem[] = [
  {
    id: 5001,
    actor: 'Risk Engine',
    action: 'Risk decision',
    details: 'Decision Approve (risk 0.12) for TXN-1001',
    status: 'success',
    entity_id: '1001',
    source: 'ml_service',
    created_at: '2026-02-16T12:21:00Z',
  },
  {
    id: 5002,
    actor: 'Risk Engine',
    action: 'Risk decision',
    details: 'Decision Decline (risk 0.89) for TXN-1002',
    status: 'success',
    entity_id: '1002',
    source: 'ml_service',
    created_at: '2026-02-16T12:24:00Z',
  },
  {
    id: 5003,
    actor: 'Risk Engine',
    action: 'Risk decision',
    details: 'Decision Approve (risk 0.28) for TXN-1003',
    status: 'success',
    entity_id: '1003',
    source: 'ml_service',
    created_at: '2026-02-16T12:31:00Z',
  },
  {
    id: 5004,
    actor: 'Risk Engine',
    action: 'Risk decision',
    details: 'Decision Decline (risk 0.61) for TXN-1004',
    status: 'warning',
    entity_id: '1004',
    source: 'local_pkl',
    created_at: '2026-02-16T12:41:00Z',
  },
  {
    id: 5005,
    actor: 'Risk Ops',
    action: 'Manual review',
    details: 'Flagged TXN-1005 for verification',
    status: 'warning',
    entity_id: '1005',
    source: 'manual',
    created_at: '2026-02-16T12:57:00Z',
  },
  {
    id: 5006,
    actor: 'Risk Engine',
    action: 'Risk decision',
    details: 'Decision Approve (risk 0.18) for TXN-1005',
    status: 'success',
    entity_id: '1005',
    source: 'ml_service',
    created_at: '2026-02-16T12:58:00Z',
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
  const text = await response.text();
  if (!text.trim()) {
    return `Request failed (${response.status})`;
  }

  try {
    const data = JSON.parse(text) as { detail?: string };
    return data?.detail ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
};

const parseJsonResponse = async <T>(response: Response, label: string): Promise<T> => {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`${label} returned empty response (${response.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label} returned invalid JSON (${response.status})`);
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

export async function predictBNPLRisk(payload: FairlensPredictRequest): Promise<FairlensPredictResponse> {
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

  return parseJsonResponse<FairlensPredictResponse>(response, 'Prediction');
}

export async function fetchStats(mode: DashboardMode = getDashboardMode()): Promise<BackendStats> {
  if (mode === 'demo') {
    return buildDemoStats();
  }

  const response = await fetch(`${backendBaseUrl}/stats`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return parseJsonResponse<BackendStats>(response, 'Stats');
}

export async function fetchLogs(page = 1, limit = 20, mode: DashboardMode = getDashboardMode()): Promise<BackendLogsResponse> {
  if (mode === 'demo') {
    return {
      page,
      limit,
      total: demoLogs.length,
      total_pages: 1,
      items: demoLogs.slice(0, limit),
    };
  }

  const response = await fetch(`${backendBaseUrl}/logs?page=${page}&limit=${limit}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return parseJsonResponse<BackendLogsResponse>(response, 'Logs');
}

type AuditLogFilters = {
  status?: string;
  search?: string;
};

export async function fetchAuditLogs(
  page = 1,
  limit = 20,
  mode: DashboardMode = getDashboardMode(),
  filters: AuditLogFilters = {}
): Promise<BackendAuditLogsResponse> {
  const normalizedStatus = filters.status && filters.status !== 'all' ? filters.status : undefined;
  const normalizedSearch = filters.search?.trim();

  if (mode === 'demo') {
    let items = [...demoAuditLogs];

    if (normalizedStatus) {
      items = items.filter((log) => log.status === normalizedStatus);
    }

    if (normalizedSearch) {
      const query = normalizedSearch.toLowerCase();
      items = items.filter((log) =>
        [log.actor, log.action, log.details, log.entity_id]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query))
      );
    }

    const total = items.length;
    const total_pages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const pagedItems = items.slice(start, start + limit);

    return {
      page,
      limit,
      total,
      total_pages,
      items: pagedItems,
    };
  }

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (normalizedStatus) {
    params.set('status', normalizedStatus);
  }
  if (normalizedSearch) {
    params.set('search', normalizedSearch);
  }

  const response = await fetch(`${backendBaseUrl}/audit-logs?${params.toString()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return parseJsonResponse<BackendAuditLogsResponse>(response, 'Audit logs');
}
