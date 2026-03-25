import {
  AssistantQueryRequest,
  AssistantQueryResponse,
  AdminOverrideRequest,
  BackendApplicationItem,
  BackendApplicationsResponse,
  BackendAuditLogsResponse,
  BackendLogItem,
  BackendLogsResponse,
  BackendStats,
  CreateAssessmentRequest,
  CreateApplicationRequest,
  EMIRequest,
  FairlensPredictRequest,
  FairlensPredictResponse,
  WorkerAssessmentItem,
  WorkerDocumentItem,
  WorkerExtractionJobItem,
} from '@/types';
import { getAccessToken } from '@/lib/authClient';

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ??
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '') ??
  'http://localhost:10000';
const riskApiBaseUrl =
  process.env.NEXT_PUBLIC_RISK_API_URL?.replace(/\/$/, '') ?? apiBaseUrl;

type ApiEnvelopeError = {
  code?: string;
  message?: string;
};

type ApiEnvelope<T> = {
  data: T | null;
  error: ApiEnvelopeError | null;
  meta?: {
    requestId?: string;
    timestamp?: string;
  };
};

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

const buildHeaders = async (
  options: { isMutation: boolean; includeJson: boolean; idempotencyKey?: string }
): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    'X-Request-Id': createRequestId(),
  };

  if (options.includeJson) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.isMutation) {
    headers['Idempotency-Key'] = options.idempotencyKey ?? createRequestId();
  }

  const token = await getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

export const mapLogToEMIRequest = (item: BackendLogItem): EMIRequest => {
  const effectiveDecision = item.final_decision ?? item.decision;
  const riskScore = toPercent(item.risk_probability);
  const creditScore = clamp(Math.round(850 - item.risk_probability * 350), 300, 850);
  const dti = Math.round(clamp(item.total_burden_ratio, 0, 1) * 100);
  const estimatedPurchaseAmount = Math.max(0, item.avg_monthly_inflow * item.purchase_to_inflow_ratio);
  const emiAmount =
    item.order_amount_inr && item.tenure_months
      ? Math.round(item.order_amount_inr / Math.max(item.tenure_months, 1))
      : Math.round(estimatedPurchaseAmount / 6);
  const existingEmis = Math.round(item.avg_monthly_outflow * 0.3);

  const creditScoreWeight = clamp(Math.round((1 - item.risk_probability) * 35), 5, 35);
  const dtiWeight = clamp(Math.round(item.total_burden_ratio * 30), 5, 30);
  const emiLoad = clamp(Math.round(item.purchase_to_inflow_ratio * 20), 5, 20);
  const savingsWeight = clamp(Math.round((1 - clamp(item.buffer_ratio, 0, 1)) * 10), 5, 10);
  const stabilityScore = clamp(100 - (creditScoreWeight + dtiWeight + emiLoad + savingsWeight), 10, 80);

  const userSub = item.user_sub?.trim();
  const buyerId = userSub || `BUY-${String(item.id).padStart(5, '0')}`;
  const buyerName = userSub ? userSub.split('|').pop() || userSub : `Applicant ${item.id}`;

  return {
    id: item.application_uuid ?? `TXN-${item.id}`,
    applicationUuid: item.application_uuid,
    buyerId,
    buyerName,
    creditScore,
    dti,
    riskScore,
    debtProbability: riskScore,
    emiAmount,
    productCategory: item.bank ? `EMI • ${item.bank}` : 'Retail Purchase',
    status: toStatus(effectiveDecision),
    monthlyIncome: Math.round(item.monthly_income_inr ?? item.avg_monthly_inflow),
    existingEmis,
    fixedExpenses: Math.round(item.avg_monthly_outflow),
    savingsBuffer: Math.round(item.min_balance_30d),
    creditScoreWeight,
    dtiWeight,
    emiLoad,
    savingsWeight,
    stabilityScore,
    riskProbability: item.risk_probability,
    autoDecision: item.auto_decision ?? item.decision,
    finalDecision: effectiveDecision,
    decisionSource: item.decision_source ?? 'auto',
    reviewedBy: item.reviewed_by ?? undefined,
    overrideReason: item.override_reason ?? undefined,
    createdAt: item.created_at,
  };
};

const parseError = async (response: Response): Promise<string> => {
  const text = await response.text();
  if (!text.trim()) {
    return `Request failed (${response.status})`;
  }

  try {
    const data = JSON.parse(text) as
      | { detail?: string; message?: string; error?: ApiEnvelopeError | null }
      | ApiEnvelope<unknown>;
    if (typeof (data as { detail?: string }).detail === 'string') {
      return (data as { detail: string }).detail;
    }
    if ((data as { error?: ApiEnvelopeError | null }).error?.message) {
      return (data as { error: ApiEnvelopeError }).error.message ?? `Request failed (${response.status})`;
    }
    if (typeof (data as { message?: string }).message === 'string') {
      return (data as { message: string }).message;
    }
    return `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
};

const isApiEnvelope = <T>(value: unknown): value is ApiEnvelope<T> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return Object.prototype.hasOwnProperty.call(record, 'data') && Object.prototype.hasOwnProperty.call(record, 'error');
};

const parseJsonResponse = async <T>(response: Response, label: string): Promise<T> => {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`${label} returned empty response (${response.status})`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${label} returned invalid JSON (${response.status})`);
  }

  if (!isApiEnvelope<T>(parsed)) {
    return parsed as T;
  }

  if (parsed.error) {
    throw new Error(parsed.error.message || `${label} failed (${response.status})`);
  }
  if (parsed.data === null) {
    throw new Error(`${label} returned empty data (${response.status})`);
  }
  return parsed.data;
};

export async function predictBNPLRisk(payload: FairlensPredictRequest): Promise<FairlensPredictResponse> {
  const headers = await buildHeaders({ isMutation: true, includeJson: true });
  const response = await fetch(`${riskApiBaseUrl}/predict`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return parseJsonResponse<FairlensPredictResponse>(response, 'Prediction');
}

export async function createApplication(
  payload: CreateApplicationRequest,
  idempotencyKey?: string
): Promise<BackendApplicationItem> {
  const headers = await buildHeaders({
    isMutation: true,
    includeJson: true,
    idempotencyKey,
  });
  const response = await fetch(`${apiBaseUrl}/v1/applications`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return parseJsonResponse<BackendApplicationItem>(response, 'Create application');
}

export async function createStatementDocument(
  payload: {
    storage_key: string;
    file_name?: string;
    mime_type?: string;
    source?: string;
  },
  idempotencyKey?: string
): Promise<WorkerDocumentItem> {
  const headers = await buildHeaders({
    isMutation: true,
    includeJson: true,
    idempotencyKey,
  });
  const response = await fetch(`${apiBaseUrl}/v1/documents`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return parseJsonResponse<WorkerDocumentItem>(response, 'Create statement document');
}

export async function fetchExtractionJob(extractionJobId: string): Promise<WorkerExtractionJobItem> {
  const headers = await buildHeaders({ isMutation: false, includeJson: false });
  const response = await fetch(`${apiBaseUrl}/v1/extraction-jobs/${extractionJobId}`, {
    cache: 'no-store',
    headers,
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return parseJsonResponse<WorkerExtractionJobItem>(response, 'Extraction job');
}

export async function createAssessment(
  payload: CreateAssessmentRequest,
  idempotencyKey?: string
): Promise<WorkerAssessmentItem> {
  const headers = await buildHeaders({
    isMutation: true,
    includeJson: true,
    idempotencyKey,
  });
  const response = await fetch(`${apiBaseUrl}/v1/assessments`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return parseJsonResponse<WorkerAssessmentItem>(response, 'Create assessment');
}

export async function fetchMyApplications(page = 1, limit = 20): Promise<BackendApplicationsResponse> {
  const headers = await buildHeaders({ isMutation: false, includeJson: false });
  const response = await fetch(`${apiBaseUrl}/v1/applications/me?page=${page}&limit=${limit}`, {
    cache: 'no-store',
    headers,
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return parseJsonResponse<BackendApplicationsResponse>(response, 'My applications');
}

type ApplicationFilters = {
  status?: string;
  search?: string;
};

export async function fetchAdminApplications(
  page = 1,
  limit = 20,
  filters: ApplicationFilters = {}
): Promise<BackendApplicationsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (filters.status && filters.status !== 'all') {
    params.set('status', filters.status);
  }
  if (filters.search?.trim()) {
    params.set('search', filters.search.trim());
  }

  const headers = await buildHeaders({ isMutation: false, includeJson: false });
  const response = await fetch(`${apiBaseUrl}/v1/admin/applications?${params.toString()}`, {
    cache: 'no-store',
    headers,
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return parseJsonResponse<BackendApplicationsResponse>(response, 'Admin applications');
}

export async function fetchAdminApplication(applicationUuid: string): Promise<BackendApplicationItem> {
  const headers = await buildHeaders({ isMutation: false, includeJson: false });
  const response = await fetch(`${apiBaseUrl}/v1/admin/applications/${applicationUuid}`, {
    cache: 'no-store',
    headers,
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return parseJsonResponse<BackendApplicationItem>(response, 'Admin application detail');
}

export async function overrideAdminApplication(
  applicationUuid: string,
  payload: AdminOverrideRequest
): Promise<BackendApplicationItem> {
  const headers = await buildHeaders({ isMutation: true, includeJson: true });
  const response = await fetch(`${apiBaseUrl}/v1/admin/applications/${applicationUuid}/override`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return parseJsonResponse<BackendApplicationItem>(response, 'Admin override');
}

export async function fetchStats(): Promise<BackendStats> {
  const headers = await buildHeaders({ isMutation: false, includeJson: false });
  const response = await fetch(`${apiBaseUrl}/v1/stats`, { cache: 'no-store', headers });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return parseJsonResponse<BackendStats>(response, 'Stats');
}

export async function fetchLogs(page = 1, limit = 20): Promise<BackendLogsResponse> {
  const response = await fetchAdminApplications(page, limit);
  return {
    page: response.page,
    limit: response.limit,
    total: response.total,
    total_pages: response.total_pages,
    items: response.items,
  };
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
  const response = await fetch(`${apiBaseUrl}/v1/audit-logs?${params.toString()}`, {
    cache: 'no-store',
    headers,
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return parseJsonResponse<BackendAuditLogsResponse>(response, 'Audit logs');
}

export async function queryAssistant(payload: AssistantQueryRequest): Promise<AssistantQueryResponse> {
  const headers = await buildHeaders({ isMutation: false, includeJson: true });
  const response = await fetch(`${apiBaseUrl}/v1/assistant/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return parseJsonResponse<AssistantQueryResponse>(response, 'Assistant');
}

