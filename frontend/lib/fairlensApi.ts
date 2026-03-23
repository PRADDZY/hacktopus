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
import { getAccessToken } from '@/lib/authClient';

const backendBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '') ?? 'http://localhost:10000';

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const toPercent = (value: number): number => Math.round(clamp(value, 0, 1) * 100);

const toStatus = (decision: 'Approve' | 'Decline'): EMIRequest['status'] =>
  decision === 'Approve' ? 'Approved' : 'Rejected';

const createRequestId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const buildHeaders = async (options: { isMutation: boolean; includeJson: boolean }): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    'X-Request-Id': createRequestId(),
  };

  if (options.includeJson) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.isMutation) {
    headers['Idempotency-Key'] = createRequestId();
  }

  const token = await getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

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

export async function predictBNPLRisk(payload: FairlensPredictRequest): Promise<FairlensPredictResponse> {
  const headers = await buildHeaders({ isMutation: true, includeJson: true });
  const response = await fetch(`${backendBaseUrl}/predict`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Prediction failed with status ${response.status}`);
  }

  return parseJsonResponse<FairlensPredictResponse>(response, 'Prediction');
}

export async function fetchStats(): Promise<BackendStats> {
  const headers = await buildHeaders({ isMutation: false, includeJson: false });
  const response = await fetch(`${backendBaseUrl}/stats`, { cache: 'no-store', headers });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return parseJsonResponse<BackendStats>(response, 'Stats');
}

export async function fetchLogs(page = 1, limit = 20): Promise<BackendLogsResponse> {
  const headers = await buildHeaders({ isMutation: false, includeJson: false });
  const response = await fetch(`${backendBaseUrl}/logs?page=${page}&limit=${limit}`, {
    cache: 'no-store',
    headers,
  });
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
  filters: AuditLogFilters = {}
): Promise<BackendAuditLogsResponse> {
  const normalizedStatus = filters.status && filters.status !== 'all' ? filters.status : undefined;
  const normalizedSearch = filters.search?.trim();

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

  const headers = await buildHeaders({ isMutation: false, includeJson: false });
  const response = await fetch(`${backendBaseUrl}/audit-logs?${params.toString()}`, {
    cache: 'no-store',
    headers,
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return parseJsonResponse<BackendAuditLogsResponse>(response, 'Audit logs');
}
