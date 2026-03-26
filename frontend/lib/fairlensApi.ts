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
  WorkerAssessmentItem,
  WorkerAdminAssessmentsResponse,
  WorkerDocumentItem,
  WorkerExtractionJobItem,
} from '@/types';
import { resolveApiBaseUrl } from '@/lib/apiBaseUrl';
import { getAccessToken } from '@/lib/authClient';

const getApiBaseUrl = (): string => resolveApiBaseUrl();

type ApiEnvelopeError = {
  code?: string;
  message?: string;
  details?: unknown;
};

type ApiEnvelope<T> = {
  data: T | null;
  error: ApiEnvelopeError | null;
  meta?: {
    requestId?: string;
    timestamp?: string;
  };
};

type FairlensApiErrorInit = {
  status: number;
  code?: string;
  details?: unknown;
  requestId?: string;
};

export class FairlensApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(message: string, init: FairlensApiErrorInit) {
    super(message);
    this.name = 'FairlensApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.requestId = init.requestId;
  }
}

export const isFairlensApiError = (value: unknown): value is FairlensApiError =>
  value instanceof FairlensApiError;

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
    productCategory: item.bank ? `EMI - ${item.bank}` : 'Retail Purchase',
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

const parseError = async (response: Response, label = 'Request'): Promise<FairlensApiError> => {
  const fallbackMessage = `${label} failed (${response.status})`;
  const text = await response.text();
  if (!text.trim()) {
    return new FairlensApiError(fallbackMessage, {
      status: response.status,
    });
  }

  try {
    const data = JSON.parse(text) as
      | {
          detail?: string;
          message?: string;
          error?: ApiEnvelopeError | null;
          meta?: { requestId?: string };
        }
      | ApiEnvelope<unknown>;
    const requestId =
      typeof (data as { meta?: { requestId?: string } }).meta?.requestId === 'string'
        ? (data as { meta?: { requestId?: string } }).meta?.requestId
        : undefined;

    if (typeof (data as { detail?: string }).detail === 'string') {
      return new FairlensApiError((data as { detail: string }).detail, {
        status: response.status,
        requestId,
      });
    }

    const envelopeError = (data as { error?: ApiEnvelopeError | null }).error;
    if (envelopeError?.message) {
      return new FairlensApiError(envelopeError.message, {
        status: response.status,
        code: envelopeError.code,
        details: envelopeError.details,
        requestId,
      });
    }
    if (typeof (data as { message?: string }).message === 'string') {
      return new FairlensApiError((data as { message: string }).message, {
        status: response.status,
        requestId,
      });
    }
    return new FairlensApiError(fallbackMessage, {
      status: response.status,
      requestId,
    });
  } catch {
    return new FairlensApiError(fallbackMessage, {
      status: response.status,
    });
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
    throw new FairlensApiError(parsed.error.message || `${label} failed (${response.status})`, {
      status: response.status,
      code: parsed.error.code,
      details: parsed.error.details,
      requestId: parsed.meta?.requestId,
    });
  }
  if (parsed.data === null) {
    throw new FairlensApiError(`${label} returned empty data (${response.status})`, {
      status: response.status,
      requestId: parsed.meta?.requestId,
    });
  }
  return parsed.data;
};

const requestJson = async <T>({
  label,
  path,
  method = 'GET',
  payload,
  isMutation,
  idempotencyKey,
  cache
}: {
  label: string;
  path: string;
  method?: 'GET' | 'POST';
  payload?: unknown;
  isMutation?: boolean;
  idempotencyKey?: string;
  cache?: RequestCache;
}): Promise<T> => {
  const includeJson = method !== 'GET' || payload !== undefined;
  const headers = await buildHeaders({
    isMutation: Boolean(isMutation),
    includeJson,
    idempotencyKey
  });

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers,
    cache,
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await parseError(response, label);
  }
  return parseJsonResponse<T>(response, label);
};

export async function createApplication(
  payload: CreateApplicationRequest,
  idempotencyKey?: string
): Promise<BackendApplicationItem> {
  return requestJson<BackendApplicationItem>({
    label: 'Create application',
    path: '/v1/applications',
    method: 'POST',
    payload,
    isMutation: true,
    idempotencyKey
  });
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
  return requestJson<WorkerDocumentItem>({
    label: 'Create statement document',
    path: '/v1/documents',
    method: 'POST',
    payload,
    isMutation: true,
    idempotencyKey
  });
}

export async function fetchExtractionJob(extractionJobId: string): Promise<WorkerExtractionJobItem> {
  return requestJson<WorkerExtractionJobItem>({
    label: 'Extraction job',
    path: `/v1/extraction-jobs/${extractionJobId}`,
    cache: 'no-store'
  });
}

export async function createAssessment(
  payload: CreateAssessmentRequest,
  idempotencyKey?: string
): Promise<WorkerAssessmentItem> {
  return requestJson<WorkerAssessmentItem>({
    label: 'Create assessment',
    path: '/v1/assessments',
    method: 'POST',
    payload,
    isMutation: true,
    idempotencyKey
  });
}

export async function fetchAdminAssessments(
  page = 1,
  limit = 20
): Promise<WorkerAdminAssessmentsResponse> {
  return requestJson<WorkerAdminAssessmentsResponse>({
    label: 'Admin assessments',
    path: `/v1/admin/assessments?page=${page}&limit=${limit}`,
    cache: 'no-store'
  });
}

export async function fetchMyApplications(page = 1, limit = 20): Promise<BackendApplicationsResponse> {
  return requestJson<BackendApplicationsResponse>({
    label: 'My applications',
    path: `/v1/applications/me?page=${page}&limit=${limit}`,
    cache: 'no-store'
  });
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

  return requestJson<BackendApplicationsResponse>({
    label: 'Admin applications',
    path: `/v1/admin/applications?${params.toString()}`,
    cache: 'no-store'
  });
}

export async function fetchAdminApplication(applicationUuid: string): Promise<BackendApplicationItem> {
  return requestJson<BackendApplicationItem>({
    label: 'Admin application detail',
    path: `/v1/admin/applications/${applicationUuid}`,
    cache: 'no-store'
  });
}

export async function overrideAdminApplication(
  applicationUuid: string,
  payload: AdminOverrideRequest
): Promise<BackendApplicationItem> {
  return requestJson<BackendApplicationItem>({
    label: 'Admin override',
    path: `/v1/admin/applications/${applicationUuid}/override`,
    method: 'POST',
    payload,
    isMutation: true
  });
}

export async function fetchStats(): Promise<BackendStats> {
  return requestJson<BackendStats>({
    label: 'Stats',
    path: '/v1/stats',
    cache: 'no-store'
  });
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

  return requestJson<BackendAuditLogsResponse>({
    label: 'Audit logs',
    path: `/v1/audit-logs?${params.toString()}`,
    cache: 'no-store'
  });
}

export async function queryAssistant(payload: AssistantQueryRequest): Promise<AssistantQueryResponse> {
  return requestJson<AssistantQueryResponse>({
    label: 'Assistant',
    path: '/v1/assistant/query',
    method: 'POST',
    payload
  });
}

