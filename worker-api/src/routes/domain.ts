import { Context, Hono } from 'hono';
import { requireAdminAuth, requireUserAuth } from '../auth';
import { failure, success, toApiStatus, type ApiStatus } from '../http';
import {
  abandonIdempotency,
  beginIdempotency,
  createIdempotencyHash,
  finalizeIdempotency,
  readIdempotencyKey,
  type ApiErrorPayload
} from '../idempotency';
import {
  SupabaseError,
  SupabaseRestClient,
  type QueryFilters,
  type SupabaseQueryParams
} from '../supabase';
import type { AppEnv } from '../types';

type Decision = 'Approve' | 'Decline';
type DecisionSource = 'auto' | 'manual_override';

type DocumentRecord = {
  id: string;
  owner_sub: string;
  storage_key: string;
  file_name?: string | null;
  mime_type?: string | null;
  source?: string | null;
  status?: string | null;
  extraction_job_id?: string | null;
};

type ExtractedFeatureRecord = {
  id: string;
  document_id: string;
  owner_sub: string;
  payload: Record<string, unknown>;
};

type AssessmentRecord = {
  id: string;
  owner_sub: string;
  document_id: string;
  extracted_feature_id: string | null;
  risk_probability: number;
  auto_decision: Decision;
  final_decision: Decision;
  decision_source: DecisionSource;
  reviewed_by?: string | null;
  override_reason?: string | null;
};

type TransactionRecord = {
  id: number;
  application_uuid: string;
  user_sub: string | null;
  idempotency_key: string | null;
  order_amount_inr: number | null;
  tenure_months: number | null;
  monthly_income_inr: number | null;
  bank: string | null;
  card_type: string | null;
  card_last_four_masked: string | null;
  avg_monthly_inflow: number;
  inflow_volatility: number;
  avg_monthly_outflow: number;
  min_balance_30d: number;
  neg_balance_days_30d: number;
  purchase_to_inflow_ratio: number;
  total_burden_ratio: number;
  buffer_ratio: number;
  stress_index: number;
  risk_probability: number;
  model_source: string | null;
  auto_decision: Decision | null;
  final_decision: Decision | null;
  decision_source: DecisionSource | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  override_reason: string | null;
  decision: Decision;
  created_at: string;
  updated_at: string;
};

type AuditLogRecord = {
  id: number;
  actor: string;
  action: string;
  details: string;
  status: string;
  entity_id: string | null;
  source: string | null;
  created_at: string;
};

type ExtractionJobRecord = {
  id: string;
  document_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  provider?: string | null;
  external_job_id?: string | null;
  error_message?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
};

const routes = new Hono<AppEnv>();

const clamp = (value: number, min = 0, max = 1): number => Math.max(min, Math.min(max, value));

const asNonEmpty = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const readAdminRoles = (env: AppEnv['Bindings']): string[] =>
  (env.AUTH_ADMIN_ROLES ?? 'admin')
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);

const isAdmin = (env: AppEnv['Bindings'], roles: string[]): boolean => {
  const allowed = readAdminRoles(env);
  return roles.some((role) => allowed.includes(role.trim().toLowerCase()));
};

const normalizeDecision = (value: unknown): Decision | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (['approve', 'approved'].includes(normalized)) {
    return 'Approve';
  }
  if (['decline', 'declined', 'reject', 'rejected'].includes(normalized)) {
    return 'Decline';
  }
  return null;
};

const normalizeJobStatus = (
  value: unknown
): 'queued' | 'processing' | 'completed' | 'failed' | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (['queued', 'processing', 'completed', 'failed'].includes(normalized)) {
    return normalized as 'queued' | 'processing' | 'completed' | 'failed';
  }
  return null;
};

const parsePage = (value: string | undefined): number => {
  const parsed = Number(value ?? '1');
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
};

const parseLimit = (value: string | undefined): number => {
  const parsed = Number(value ?? '20');
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 20;
  }
  return Math.min(200, Math.floor(parsed));
};

const getThreshold = (env: AppEnv['Bindings']): number => {
  const parsed = Number(env.RISK_APPROVAL_THRESHOLD ?? '0.55');
  if (!Number.isFinite(parsed)) {
    return 0.55;
  }
  return clamp(parsed);
};

const getModelVersion = (env: AppEnv['Bindings']): string =>
  asNonEmpty(env.MODEL_VERSION) ?? 'worker-baseline-v1';

const getModelScoringEndpoint = (env: AppEnv['Bindings']): string | null =>
  asNonEmpty(env.MODEL_SCORING_ENDPOINT);

const getModelScoringToken = (env: AppEnv['Bindings']): string | null =>
  asNonEmpty(env.MODEL_SCORING_TOKEN);

const isWorkerScoringFallbackEnabled = (env: AppEnv['Bindings']): boolean => {
  const raw = asNonEmpty(env.WORKER_SCORING_FALLBACK_ENABLED);
  if (!raw) {
    return false;
  }
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
};

const getFeatureExtractionEndpoint = (env: AppEnv['Bindings']): string | null => {
  const explicit = asNonEmpty(env.FEATURE_EXTRACTION_ENDPOINT);
  if (explicit) {
    return explicit;
  }

  const modelEndpoint = getModelScoringEndpoint(env);
  if (!modelEndpoint) {
    return null;
  }
  if (modelEndpoint.endsWith('/predict')) {
    return modelEndpoint.replace(/\/predict$/, '/featureize/statement');
  }
  return `${modelEndpoint.replace(/\/$/, '')}/featureize/statement`;
};

const getFeatureExtractionToken = (env: AppEnv['Bindings']): string | null =>
  asNonEmpty(env.FEATURE_EXTRACTION_TOKEN) ?? getModelScoringToken(env);

const getModalEndpoint = (env: AppEnv['Bindings']): string | null =>
  asNonEmpty(env.MODAL_EXTRACTION_ENDPOINT);

const getCallbackSecret = (env: AppEnv['Bindings']): string | null =>
  asNonEmpty(env.EXTRACTION_CALLBACK_SECRET);

const normalizeDecisionSource = (value: unknown): DecisionSource | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'auto') {
    return 'auto';
  }
  if (normalized === 'manual_override') {
    return 'manual_override';
  }
  return null;
};

const sanitizeSearchTerm = (value: string | undefined): string | null => {
  const raw = asNonEmpty(value);
  if (!raw) {
    return null;
  }

  const sanitized = raw.replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim();
  return sanitized || null;
};

const toIsoNow = (): string => new Date().toISOString();

const createApplicationUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `app-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const maskCardLastFour = (value: string): string => `****${value.slice(-4)}`;

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const toPositiveNumber = (value: unknown): number | null => {
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed <= 0) {
    return null;
  }
  return parsed;
};

const toIntegerInRange = (value: unknown, min: number, max: number): number | null => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) {
    return null;
  }
  const asInt = Math.floor(parsed);
  if (asInt < min || asInt > max) {
    return null;
  }
  return asInt;
};

const replayIdempotentResult = (
  c: Context<AppEnv>,
  replay: {
    status: number;
    data: unknown;
    error: ApiErrorPayload | null;
  }
): Response => {
  if (replay.error) {
    return failure(c, replay.error, toApiStatus(replay.status, 400));
  }
  return success(c, replay.data, toApiStatus(replay.status, 200));
};

const abandonIdempotencyIfNeeded = async (
  c: Context<AppEnv>,
  idempotencyRecordId: string | null
): Promise<void> => {
  if (!idempotencyRecordId) {
    return;
  }

  try {
    const supabase = new SupabaseRestClient(c);
    await abandonIdempotency({
      supabase,
      recordId: idempotencyRecordId
    });
  } catch {
    // Best effort cleanup only.
  }
};

const readNumber = (
  payload: Record<string, unknown>,
  keys: string[],
  fallback: number
): number => {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return fallback;
};

const readInt = (
  payload: Record<string, unknown>,
  keys: string[],
  fallback: number
): number => Math.max(0, Math.floor(readNumber(payload, keys, fallback)));

const normalizeRiskFeatures = (payload: Record<string, unknown>): Record<string, unknown> => {
  const segment = asNonEmpty(payload.segment) ?? 'unknown';
  const monthlyInflow = Math.max(readNumber(payload, ['monthly_inflow', 'avg_monthly_inflow'], 1), 1);
  const monthlyOutflow = Math.max(
    readNumber(payload, ['monthly_outflow', 'avg_monthly_outflow'], monthlyInflow * 0.55),
    0
  );
  const totalBurden = Math.max(
    readNumber(payload, ['total_burden_ratio'], (monthlyOutflow + monthlyInflow * 0.1) / monthlyInflow),
    0
  );
  const monthlyInstallmentBurden = Math.max(
    readNumber(payload, ['monthly_installment_burden'], monthlyInflow * Math.min(totalBurden, 1) * 0.2),
    0
  );
  const purchaseAmount = Math.max(
    readNumber(payload, ['purchase_amount'], monthlyInflow * readNumber(payload, ['purchase_to_inflow_ratio'], 0.2)),
    0
  );
  const minBalance = readNumber(payload, ['min_balance_30d'], Math.max(0, monthlyInflow - monthlyOutflow));
  const bufferRatio = Math.max(readNumber(payload, ['buffer_ratio'], minBalance / monthlyInflow), 0);
  const inflowVolatility = Math.max(
    readNumber(payload, ['inflow_volatility_90d', 'inflow_volatility'], 0.25),
    0
  );
  const outflowVolatility = Math.max(
    readNumber(payload, ['outflow_volatility_90d', 'outflow_volatility'], 0.3),
    0
  );
  const stressIndex = Math.max(
    readNumber(payload, ['stress_index'], inflowVolatility * 0.45 + Math.min(totalBurden, 1) * 0.55),
    0
  );
  const installmentToInflow = Math.max(
    readNumber(payload, ['installment_to_inflow_ratio'], monthlyInstallmentBurden / monthlyInflow),
    0
  );

  return {
    segment,
    monthly_inflow: Number(monthlyInflow.toFixed(6)),
    monthly_outflow: Number(monthlyOutflow.toFixed(6)),
    inflow_volatility_90d: Number(inflowVolatility.toFixed(6)),
    outflow_volatility_90d: Number(outflowVolatility.toFixed(6)),
    deposit_count_30d: readInt(payload, ['deposit_count_30d'], 4),
    days_since_last_income: readInt(payload, ['days_since_last_income'], 7),
    avg_balance_30d: Number(readNumber(payload, ['avg_balance_30d'], monthlyInflow * 0.25).toFixed(6)),
    min_balance_30d: Number(minBalance.toFixed(6)),
    negative_balance_days_30d: readInt(payload, ['negative_balance_days_30d', 'neg_balance_days_30d'], 0),
    essential_spend_ratio: Number(
      Math.max(readNumber(payload, ['essential_spend_ratio'], monthlyOutflow / monthlyInflow), 0).toFixed(6)
    ),
    active_loan_count: readInt(payload, ['active_loan_count'], totalBurden > 0.65 ? 2 : 1),
    monthly_installment_burden: Number(monthlyInstallmentBurden.toFixed(6)),
    purchase_amount: Number(purchaseAmount.toFixed(6)),
    tenure_weeks: Math.max(readInt(payload, ['tenure_weeks'], 24), 1),
    purchase_to_inflow_ratio: Number(
      Math.max(readNumber(payload, ['purchase_to_inflow_ratio'], purchaseAmount / monthlyInflow), 0).toFixed(6)
    ),
    installment_to_inflow_ratio: Number(installmentToInflow.toFixed(6)),
    total_burden_ratio: Number(totalBurden.toFixed(6)),
    buffer_ratio: Number(bufferRatio.toFixed(6)),
    stress_index: Number(stressIndex.toFixed(6))
  };
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asTransactionArray = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
};

const looksLikeRiskFeatures = (value: unknown): value is Record<string, unknown> => {
  const payload = asRecord(value);
  if (!payload) {
    return false;
  }
  return (
    payload.monthly_inflow !== undefined &&
    payload.monthly_outflow !== undefined &&
    payload.stress_index !== undefined
  );
};

const resolveFeaturePayload = (value: unknown): Record<string, unknown> | null => {
  if (looksLikeRiskFeatures(value)) {
    return value;
  }
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  if (looksLikeRiskFeatures(record.features)) {
    return record.features as Record<string, unknown>;
  }
  const data = asRecord(record.data);
  if (data && looksLikeRiskFeatures(data.features)) {
    return data.features as Record<string, unknown>;
  }
  return null;
};

const buildStatementFeatureRequest = (
  body: Record<string, unknown>
): Record<string, unknown> | null => {
  const statement = asRecord(body.statement);
  if (!statement) {
    return null;
  }

  const transactions = asTransactionArray(statement.transactions);
  if (transactions.length === 0) {
    return null;
  }

  const statementSegment = asNonEmpty(statement.segment);
  const bodySegment = asNonEmpty(body.segment);
  const segment = statementSegment ?? bodySegment ?? 'unknown';
  const statementWindowDays = readInt(statement, ['statement_window_days', 'window_days'], 90);
  const purchaseAmount = readNumber(statement, ['purchase_amount'], readNumber(body, ['purchase_amount'], 0));
  const tenureWeeks = readInt(statement, ['tenure_weeks'], readInt(body, ['tenure_weeks'], 24));

  return {
    segment,
    statement_window_days: Math.max(30, Math.min(180, statementWindowDays)),
    purchase_amount: Math.max(0, purchaseAmount),
    tenure_weeks: Math.max(1, tenureWeeks),
    transactions
  };
};

const extractFeaturesFromStatement = async (
  c: Context<AppEnv>,
  statementPayload: Record<string, unknown>
): Promise<Record<string, unknown> | null> => {
  const endpoint = getFeatureExtractionEndpoint(c.env);
  if (!endpoint) {
    return null;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const token = getFeatureExtractionToken(c.env);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(statementPayload)
    });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json().catch(() => null);
    return resolveFeaturePayload(payload);
  } catch {
    return null;
  }
};

const computeHeuristicRiskProbability = (payload: Record<string, unknown>): number => {
  const stress = clamp(readNumber(payload, ['stress_index'], 0.5));
  const burden = clamp(readNumber(payload, ['total_burden_ratio'], 0.5));
  const buffer = clamp(readNumber(payload, ['buffer_ratio'], 0.2));
  const negBalanceDays = clamp(
    readNumber(payload, ['negative_balance_days_30d', 'neg_balance_days_30d'], 0) / 30
  );

  const probability = stress * 0.35 + burden * 0.4 + (1 - buffer) * 0.15 + negBalanceDays * 0.1;
  return Number(clamp(probability).toFixed(6));
};

const toDecision = (riskProbability: number, threshold: number): Decision =>
  riskProbability >= threshold ? 'Decline' : 'Approve';

class ModelScoringError extends Error {
  readonly status: ApiStatus;
  readonly code: string;

  constructor(message: string, status: ApiStatus = 503, code = 'model_unavailable') {
    super(message);
    this.name = 'ModelScoringError';
    this.status = status;
    this.code = code;
  }
}

type ScoringOutcome = {
  riskProbability: number;
  decision: Decision;
  modelVersion: string;
  source: string;
};

const buildFallbackScoringOutcome = (
  c: Context<AppEnv>,
  normalizedPayload: Record<string, unknown>
): ScoringOutcome => {
  const fallbackRisk = computeHeuristicRiskProbability(normalizedPayload);
  return {
    riskProbability: fallbackRisk,
    decision: toDecision(fallbackRisk, getThreshold(c.env)),
    modelVersion: 'worker-heuristic-fallback-v2',
    source: 'worker_fallback'
  };
};

const scoreAssessment = async (
  c: Context<AppEnv>,
  rawPayload: Record<string, unknown>
): Promise<ScoringOutcome> => {
  const normalizedPayload = normalizeRiskFeatures(rawPayload);
  const fallbackEnabled = isWorkerScoringFallbackEnabled(c.env);
  const endpoint = getModelScoringEndpoint(c.env);

  if (!endpoint) {
    if (fallbackEnabled) {
      return buildFallbackScoringOutcome(c, normalizedPayload);
    }
    throw new ModelScoringError(
      'Model scoring endpoint is not configured. Set MODEL_SCORING_ENDPOINT or enable WORKER_SCORING_FALLBACK_ENABLED.'
    );
  }

  const url = endpoint.endsWith('/predict') ? endpoint : `${endpoint.replace(/\/$/, '')}/predict`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const token = getModelScoringToken(c.env);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(normalizedPayload)
    });

    if (!response.ok) {
      if (fallbackEnabled) {
        return buildFallbackScoringOutcome(c, normalizedPayload);
      }
      throw new ModelScoringError(`Model scoring request failed with status ${response.status}`);
    }

    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const riskProbability = clamp(readNumber(body, ['risk_probability'], 0.5));
    const explicitDecision = normalizeDecision(body.decision);
    const decision = explicitDecision ?? toDecision(riskProbability, getThreshold(c.env));
    const modelVersion = asNonEmpty(body.model_version) ?? getModelVersion(c.env);
    return {
      riskProbability: Number(riskProbability.toFixed(6)),
      decision,
      modelVersion,
      source: 'ml_service'
    };
  } catch (error) {
    if (error instanceof ModelScoringError) {
      throw error;
    }
    if (fallbackEnabled) {
      return buildFallbackScoringOutcome(c, normalizedPayload);
    }
    throw new ModelScoringError('Model scoring service is unavailable');
  }
};

type CreateApplicationInput = {
  orderAmountInr: number;
  tenureMonths: number;
  bank: string;
  monthlyIncomeInr: number;
  cardType: 'credit' | 'fairlens';
  cardLastFour: string;
  metadata: Record<string, unknown> | null;
};

const parseCreateApplicationInput = (
  body: Record<string, unknown>
): { value: CreateApplicationInput | null; error: string | null } => {
  const orderAmountInr = toPositiveNumber(body.order_amount_inr);
  if (orderAmountInr === null) {
    return { value: null, error: 'order_amount_inr must be a positive number' };
  }

  const tenureMonths = toIntegerInRange(body.tenure_months, 1, 36);
  if (tenureMonths === null) {
    return { value: null, error: 'tenure_months must be an integer between 1 and 36' };
  }

  const bank = asNonEmpty(body.bank);
  if (!bank || bank.length < 2 || bank.length > 120) {
    return { value: null, error: 'bank must be between 2 and 120 characters' };
  }

  const monthlyIncomeInr = toPositiveNumber(body.monthly_income_inr);
  if (monthlyIncomeInr === null) {
    return { value: null, error: 'monthly_income_inr must be a positive number' };
  }

  const cardType = asNonEmpty(body.card_type);
  if (cardType !== 'credit' && cardType !== 'fairlens') {
    return { value: null, error: 'card_type must be credit or fairlens' };
  }

  const cardLastFour = asNonEmpty(body.card_last_four);
  if (!cardLastFour || !/^\d{4}$/.test(cardLastFour)) {
    return { value: null, error: 'card_last_four must contain exactly 4 digits' };
  }

  const metadata = asRecord(body.metadata);

  return {
    value: {
      orderAmountInr: Number(orderAmountInr.toFixed(6)),
      tenureMonths,
      bank,
      monthlyIncomeInr: Number(monthlyIncomeInr.toFixed(6)),
      cardType,
      cardLastFour,
      metadata
    },
    error: null
  };
};

const deriveCheckoutRiskPayload = (input: CreateApplicationInput): Record<string, unknown> => {
  const monthlyEmi = Math.ceil(input.orderAmountInr / input.tenureMonths);
  const safeInflow = Math.max(input.monthlyIncomeInr, 1);
  const purchaseToInflowRatio = input.orderAmountInr / safeInflow;
  const avgMonthlyOutflow = Math.min(safeInflow * 0.95, safeInflow * 0.5 + monthlyEmi);
  const avgBalance30d = Math.max(0, safeInflow - avgMonthlyOutflow);
  const minBalance30d = Math.max(0, safeInflow - avgMonthlyOutflow - monthlyEmi * 0.2);
  const inflowVolatility = Math.min(1, Math.max(0.01, 0.12 + purchaseToInflowRatio * 0.2));
  const outflowVolatility = Math.min(1, Math.max(0.02, 0.16 + purchaseToInflowRatio * 0.15));
  const negBalanceDays30d = minBalance30d === 0 ? 4 : minBalance30d < safeInflow * 0.08 ? 2 : 0;
  const totalBurdenRatio = Math.min(1, (avgMonthlyOutflow + monthlyEmi) / safeInflow);
  const installmentToInflowRatio = Math.min(1, monthlyEmi / safeInflow);
  const bufferRatio = Math.max(0, minBalance30d / safeInflow);
  const stressIndex = Math.min(1, inflowVolatility * 0.45 + totalBurdenRatio * 0.55);
  const essentialSpendRatio = Math.min(1, Math.max(0.1, avgMonthlyOutflow / safeInflow));
  const activeLoanCount = totalBurdenRatio > 0.65 ? 2 : 1;

  return {
    segment: 'unknown',
    monthly_inflow: Number(safeInflow.toFixed(6)),
    monthly_outflow: Number(avgMonthlyOutflow.toFixed(6)),
    inflow_volatility_90d: Number(inflowVolatility.toFixed(6)),
    outflow_volatility_90d: Number(outflowVolatility.toFixed(6)),
    deposit_count_30d: 4,
    days_since_last_income: 7,
    avg_balance_30d: Number(avgBalance30d.toFixed(6)),
    min_balance_30d: Number(minBalance30d.toFixed(6)),
    negative_balance_days_30d: negBalanceDays30d,
    essential_spend_ratio: Number(essentialSpendRatio.toFixed(6)),
    active_loan_count: activeLoanCount,
    monthly_installment_burden: Number(monthlyEmi.toFixed(6)),
    purchase_amount: Number(input.orderAmountInr.toFixed(6)),
    tenure_weeks: input.tenureMonths * 4,
    purchase_to_inflow_ratio: Number(purchaseToInflowRatio.toFixed(6)),
    installment_to_inflow_ratio: Number(installmentToInflowRatio.toFixed(6)),
    total_burden_ratio: Number(totalBurdenRatio.toFixed(6)),
    buffer_ratio: Number(bufferRatio.toFixed(6)),
    stress_index: Number(stressIndex.toFixed(6))
  };
};

const normalizeTransaction = (transaction: TransactionRecord): TransactionRecord => {
  const autoDecision = transaction.auto_decision ?? transaction.decision;
  const finalDecision = transaction.final_decision ?? transaction.decision;
  const decisionSource = transaction.decision_source ?? 'auto';

  return {
    ...transaction,
    auto_decision: autoDecision,
    final_decision: finalDecision,
    decision_source: decisionSource,
    decision: finalDecision
  };
};

const dispatchExtractionToModal = async ({
  c,
  supabase,
  document,
  extractionJob
}: {
  c: Context<AppEnv>;
  supabase: SupabaseRestClient;
  document: DocumentRecord;
  extractionJob: ExtractionJobRecord;
}): Promise<{ extractionJobStatus: string; externalJobId: string | null }> => {
  const endpoint = getModalEndpoint(c.env);
  if (!endpoint) {
    return {
      extractionJobStatus: extractionJob.status,
      externalJobId: extractionJob.external_job_id ?? null
    };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const modalToken = asNonEmpty(c.env.MODAL_EXTRACTION_TOKEN);
  if (modalToken) {
    headers.Authorization = `Bearer ${modalToken}`;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        extraction_job_id: extractionJob.id,
        document_id: document.id,
        owner_sub: document.owner_sub,
        storage_key: document.storage_key,
        source: document.source ?? 'upload'
      })
    });

    if (!response.ok) {
      return {
        extractionJobStatus: extractionJob.status,
        externalJobId: extractionJob.external_job_id ?? null
      };
    }

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const externalJobId = asNonEmpty(payload.job_id) ?? asNonEmpty(payload.id) ?? null;

    const updatedJob = await supabase.updateOne<ExtractionJobRecord>(
      'extraction_jobs',
      { id: extractionJob.id },
      {
        status: 'processing',
        external_job_id: externalJobId,
        started_at: new Date().toISOString(),
        error_message: null
      }
    );

    await supabase.updateOne<DocumentRecord>(
      'documents',
      { id: document.id },
      {
        status: 'processing',
        error_message: null
      }
    );

    return {
      extractionJobStatus: updatedJob?.status ?? 'processing',
      externalJobId: updatedJob?.external_job_id ?? externalJobId
    };
  } catch {
    return {
      extractionJobStatus: extractionJob.status,
      externalJobId: extractionJob.external_job_id ?? null
    };
  }
};

routes.post('/applications', requireUserAuth, async (c) => {
  const user = c.get('authUser');
  if (!user.subject) {
    return failure(c, { code: 'unauthorized', message: 'Authentication required' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return failure(c, { code: 'invalid_request', message: 'Invalid JSON body' }, 400);
  }

  const parsed = parseCreateApplicationInput(body);
  if (!parsed.value) {
    return failure(c, { code: 'invalid_request', message: parsed.error ?? 'Invalid application payload' }, 400);
  }

  const idempotencyKey = readIdempotencyKey(c.req.header('Idempotency-Key'));
  const routeKey = 'post:/v1/applications';
  const requestHash = idempotencyKey
    ? await createIdempotencyHash({
        routeKey,
        ownerSub: user.subject,
        payload: body
      })
    : null;

  let idempotencyRecordId: string | null = null;

  try {
    const supabase = new SupabaseRestClient(c);

    if (idempotencyKey && requestHash) {
      const idempotency = await beginIdempotency({
        supabase,
        env: c.env,
        ownerSub: user.subject,
        routeKey,
        idempotencyKey,
        requestHash
      });

      if (idempotency.kind === 'conflict') {
        return failure(
          c,
          {
            code: 'idempotency_conflict',
            message: 'Idempotency-Key already used with a different request payload'
          },
          409
        );
      }
      if (idempotency.kind === 'in_progress') {
        return failure(
          c,
          {
            code: 'idempotency_in_progress',
            message: 'A request with this Idempotency-Key is already being processed'
          },
          409
        );
      }
      if (idempotency.kind === 'replay') {
        return replayIdempotentResult(c, idempotency);
      }
      idempotencyRecordId = idempotency.recordId;
    }

    const riskPayload = deriveCheckoutRiskPayload(parsed.value);
    const scoring = await scoreAssessment(c, riskPayload);
    const applicationUuid = createApplicationUuid();

    const transaction = await supabase.insertOne<TransactionRecord>('transactions', {
      application_uuid: applicationUuid,
      user_sub: user.subject,
      idempotency_key: idempotencyKey ?? null,
      order_amount_inr: parsed.value.orderAmountInr,
      tenure_months: parsed.value.tenureMonths,
      monthly_income_inr: parsed.value.monthlyIncomeInr,
      bank: parsed.value.bank,
      card_type: parsed.value.cardType,
      card_last_four_masked: maskCardLastFour(parsed.value.cardLastFour),
      avg_monthly_inflow: readNumber(riskPayload, ['monthly_inflow'], parsed.value.monthlyIncomeInr),
      inflow_volatility: readNumber(riskPayload, ['inflow_volatility_90d'], 0.2),
      avg_monthly_outflow: readNumber(riskPayload, ['monthly_outflow'], parsed.value.monthlyIncomeInr * 0.5),
      min_balance_30d: readNumber(riskPayload, ['min_balance_30d'], 0),
      neg_balance_days_30d: readInt(riskPayload, ['negative_balance_days_30d'], 0),
      purchase_to_inflow_ratio: readNumber(riskPayload, ['purchase_to_inflow_ratio'], 0),
      total_burden_ratio: readNumber(riskPayload, ['total_burden_ratio'], 0),
      buffer_ratio: readNumber(riskPayload, ['buffer_ratio'], 0),
      stress_index: readNumber(riskPayload, ['stress_index'], 0.5),
      risk_probability: scoring.riskProbability,
      model_source: scoring.source,
      auto_decision: scoring.decision,
      final_decision: scoring.decision,
      decision_source: 'auto',
      decision: scoring.decision,
      updated_at: toIsoNow()
    });

    const actor = user.email ?? user.subject ?? 'Checkout User';
    const metadataNote = parsed.value.metadata ? ' | metadata captured' : '';
    await supabase.insertOne<AuditLogRecord>('audit_logs', {
      actor,
      action: 'Application scored',
      details: `Decision ${scoring.decision} (risk ${scoring.riskProbability.toFixed(3)}) for APP-${applicationUuid}${metadataNote}`,
      status: scoring.source === 'ml_service' ? 'success' : 'warning',
      entity_id: String(transaction.id),
      source: scoring.source
    });

    const responseData = normalizeTransaction(transaction);

    if (idempotencyRecordId) {
      await finalizeIdempotency({
        supabase,
        env: c.env,
        recordId: idempotencyRecordId,
        status: 201,
        data: responseData,
        error: null
      });
    }

    return success(c, responseData, 201);
  } catch (error) {
    if (error instanceof ModelScoringError) {
      const responseError: ApiErrorPayload = { code: error.code, message: error.message };
      if (idempotencyRecordId) {
        const supabase = new SupabaseRestClient(c);
        await finalizeIdempotency({
          supabase,
          env: c.env,
          recordId: idempotencyRecordId,
          status: error.status,
          data: null,
          error: responseError
        });
      }
      return failure(c, responseError, error.status);
    }

    if (error instanceof SupabaseError) {
      const status = toApiStatus(error.status);
      const responseError: ApiErrorPayload = { code: 'supabase_error', message: error.message };
      if (idempotencyRecordId && status < 500) {
        const supabase = new SupabaseRestClient(c);
        await finalizeIdempotency({
          supabase,
          env: c.env,
          recordId: idempotencyRecordId,
          status,
          data: null,
          error: responseError
        });
      } else if (status >= 500) {
        await abandonIdempotencyIfNeeded(c, idempotencyRecordId);
      }
      return failure(c, responseError, status);
    }

    await abandonIdempotencyIfNeeded(c, idempotencyRecordId);
    return failure(c, { code: 'internal_error', message: 'Failed to create application' }, 500);
  }
});

routes.get('/applications/me', requireUserAuth, async (c) => {
  const user = c.get('authUser');
  if (!user.subject) {
    return failure(c, { code: 'unauthorized', message: 'Authentication required' }, 401);
  }

  const page = parsePage(c.req.query('page'));
  const limit = parseLimit(c.req.query('limit'));
  const offset = (page - 1) * limit;

  try {
    const supabase = new SupabaseRestClient(c);
    const { items, total } = await supabase.selectManyWithCount<TransactionRecord>('transactions', {
      filters: { user_sub: user.subject },
      order: 'created_at.desc',
      limit,
      offset
    });

    return success(
      c,
      {
        page,
        limit,
        total,
        total_pages: total === 0 ? 1 : Math.ceil(total / limit),
        items: items.map(normalizeTransaction)
      },
      200
    );
  } catch (error) {
    if (error instanceof SupabaseError) {
      return failure(c, { code: 'supabase_error', message: error.message }, toApiStatus(error.status));
    }
    return failure(c, { code: 'internal_error', message: 'Failed to list user applications' }, 500);
  }
});

routes.get('/admin/applications', requireAdminAuth, async (c) => {
  const page = parsePage(c.req.query('page'));
  const limit = parseLimit(c.req.query('limit'));
  const offset = (page - 1) * limit;
  const status = normalizeDecision(c.req.query('status'));
  const search = sanitizeSearchTerm(c.req.query('search'));

  const filters: QueryFilters = {};
  if (status) {
    filters.final_decision = status;
  }

  const query: SupabaseQueryParams = {};
  if (search) {
    const searchPattern = `*${search}*`;
    query.or = `(application_uuid.ilike.${searchPattern},user_sub.ilike.${searchPattern},bank.ilike.${searchPattern},card_last_four_masked.ilike.${searchPattern})`;
  }

  try {
    const supabase = new SupabaseRestClient(c);
    const { items, total } = await supabase.selectManyWithCount<TransactionRecord>('transactions', {
      filters,
      order: 'created_at.desc',
      limit,
      offset,
      query
    });

    return success(
      c,
      {
        page,
        limit,
        total,
        total_pages: total === 0 ? 1 : Math.ceil(total / limit),
        items: items.map(normalizeTransaction)
      },
      200
    );
  } catch (error) {
    if (error instanceof SupabaseError) {
      return failure(c, { code: 'supabase_error', message: error.message }, toApiStatus(error.status));
    }
    return failure(c, { code: 'internal_error', message: 'Failed to list admin applications' }, 500);
  }
});

routes.get('/admin/applications/:applicationUuid', requireAdminAuth, async (c) => {
  const applicationUuid = c.req.param('applicationUuid');
  try {
    const supabase = new SupabaseRestClient(c);
    const transaction = await supabase.selectOne<TransactionRecord>('transactions', {
      application_uuid: applicationUuid
    });
    if (!transaction) {
      return failure(c, { code: 'not_found', message: 'Application not found' }, 404);
    }
    return success(c, normalizeTransaction(transaction), 200);
  } catch (error) {
    if (error instanceof SupabaseError) {
      return failure(c, { code: 'supabase_error', message: error.message }, toApiStatus(error.status));
    }
    return failure(c, { code: 'internal_error', message: 'Failed to fetch application' }, 500);
  }
});

routes.post('/admin/applications/:applicationUuid/override', requireAdminAuth, async (c) => {
  const user = c.get('authUser');
  const applicationUuid = c.req.param('applicationUuid');

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return failure(c, { code: 'invalid_request', message: 'Invalid JSON body' }, 400);
  }

  const decision = normalizeDecision(body.decision);
  const reason = asNonEmpty(body.reason);
  if (!decision || !reason || reason.length < 3 || reason.length > 500) {
    return failure(c, { code: 'invalid_request', message: 'decision and reason are required' }, 400);
  }

  try {
    const supabase = new SupabaseRestClient(c);
    const existing = await supabase.selectOne<TransactionRecord>('transactions', {
      application_uuid: applicationUuid
    });
    if (!existing) {
      return failure(c, { code: 'not_found', message: 'Application not found' }, 404);
    }

    const actor = user.email ?? user.subject ?? 'Risk Ops';
    const updated = await supabase.updateOne<TransactionRecord>(
      'transactions',
      { application_uuid: applicationUuid },
      {
        final_decision: decision,
        decision: decision,
        decision_source: 'manual_override',
        reviewed_by: actor,
        reviewed_at: toIsoNow(),
        override_reason: reason,
        updated_at: toIsoNow()
      }
    );
    if (!updated) {
      return failure(c, { code: 'not_found', message: 'Application not found' }, 404);
    }

    await supabase.insertOne<AuditLogRecord>('audit_logs', {
      actor,
      action: 'Manual override',
      details: `Application APP-${applicationUuid} manually set to ${decision}: ${reason}`,
      status: 'warning',
      entity_id: String(updated.id),
      source: 'manual_override'
    });

    return success(c, normalizeTransaction(updated), 200);
  } catch (error) {
    if (error instanceof SupabaseError) {
      return failure(c, { code: 'supabase_error', message: error.message }, toApiStatus(error.status));
    }
    return failure(c, { code: 'internal_error', message: 'Failed to override application' }, 500);
  }
});

routes.get('/stats', requireAdminAuth, async (c) => {
  try {
    const supabase = new SupabaseRestClient(c);
    const [totalRows, approvalRows, lowRows, mediumRows, highRows] = await Promise.all([
      supabase.selectManyWithCount<TransactionRecord>('transactions', {
        limit: 1,
        offset: 0
      }),
      supabase.selectManyWithCount<TransactionRecord>('transactions', {
        filters: { decision: 'Approve' },
        limit: 1,
        offset: 0
      }),
      supabase.selectManyWithCount<TransactionRecord>('transactions', {
        filters: { risk_probability: { op: 'lt', value: 0.33 } },
        limit: 1,
        offset: 0
      }),
      supabase.selectManyWithCount<TransactionRecord>('transactions', {
        query: {
          and: '(risk_probability.gte.0.33,risk_probability.lt.0.66)'
        },
        limit: 1,
        offset: 0
      }),
      supabase.selectManyWithCount<TransactionRecord>('transactions', {
        filters: { risk_probability: { op: 'gte', value: 0.66 } },
        limit: 1,
        offset: 0
      })
    ]);

    const totalPredictions = totalRows.total;
    if (totalPredictions === 0) {
      return success(
        c,
        {
          total_predictions: 0,
          approval_rate: 0,
          decline_rate: 0,
          risk_score_distribution: { low: 0, medium: 0, high: 0 }
        },
        200
      );
    }

    const approvalCount = approvalRows.total;
    const declineCount = Math.max(0, totalPredictions - approvalCount);

    return success(
      c,
      {
        total_predictions: totalPredictions,
        approval_rate: Number((approvalCount / totalPredictions).toFixed(4)),
        decline_rate: Number((declineCount / totalPredictions).toFixed(4)),
        risk_score_distribution: {
          low: lowRows.total,
          medium: mediumRows.total,
          high: highRows.total
        }
      },
      200
    );
  } catch (error) {
    if (error instanceof SupabaseError) {
      return failure(c, { code: 'supabase_error', message: error.message }, toApiStatus(error.status));
    }
    return failure(c, { code: 'internal_error', message: 'Failed to fetch stats' }, 500);
  }
});

routes.get('/logs', requireAdminAuth, async (c) => {
  const page = parsePage(c.req.query('page'));
  const limit = parseLimit(c.req.query('limit'));
  const offset = (page - 1) * limit;

  try {
    const supabase = new SupabaseRestClient(c);
    const { items, total } = await supabase.selectManyWithCount<TransactionRecord>('transactions', {
      order: 'created_at.desc',
      limit,
      offset
    });
    return success(
      c,
      {
        page,
        limit,
        total,
        total_pages: total === 0 ? 1 : Math.ceil(total / limit),
        items: items.map(normalizeTransaction)
      },
      200
    );
  } catch (error) {
    if (error instanceof SupabaseError) {
      return failure(c, { code: 'supabase_error', message: error.message }, toApiStatus(error.status));
    }
    return failure(c, { code: 'internal_error', message: 'Failed to fetch logs' }, 500);
  }
});

routes.get('/audit-logs', requireAdminAuth, async (c) => {
  const page = parsePage(c.req.query('page'));
  const limit = parseLimit(c.req.query('limit'));
  const offset = (page - 1) * limit;
  const status = asNonEmpty(c.req.query('status'));
  const search = sanitizeSearchTerm(c.req.query('search'));

  const filters: QueryFilters = {};
  if (status) {
    filters.status = status;
  }

  const query: SupabaseQueryParams = {};
  if (search) {
    const searchPattern = `*${search}*`;
    query.or = `(action.ilike.${searchPattern},details.ilike.${searchPattern},actor.ilike.${searchPattern},entity_id.ilike.${searchPattern})`;
  }

  try {
    const supabase = new SupabaseRestClient(c);
    const { items, total } = await supabase.selectManyWithCount<AuditLogRecord>('audit_logs', {
      filters,
      order: 'created_at.desc',
      limit,
      offset,
      query
    });
    return success(
      c,
      {
        page,
        limit,
        total,
        total_pages: total === 0 ? 1 : Math.ceil(total / limit),
        items
      },
      200
    );
  } catch (error) {
    if (error instanceof SupabaseError) {
      return failure(c, { code: 'supabase_error', message: error.message }, toApiStatus(error.status));
    }
    return failure(c, { code: 'internal_error', message: 'Failed to fetch audit logs' }, 500);
  }
});

routes.post('/documents', requireUserAuth, async (c) => {
  const user = c.get('authUser');
  if (!user.subject) {
    return failure(c, { code: 'unauthorized', message: 'Authentication required' }, 401);
  }

  const idempotencyKey = readIdempotencyKey(c.req.header('Idempotency-Key'));
  if (!idempotencyKey) {
    return failure(c, { code: 'missing_idempotency_key', message: 'Idempotency-Key header is required' }, 400);
  }

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return failure(c, { code: 'invalid_request', message: 'Invalid JSON body' }, 400);
  }

  const storageKey = asNonEmpty(body.storage_key);
  if (!storageKey) {
    return failure(c, { code: 'invalid_request', message: 'storage_key is required' }, 400);
  }

  const routeKey = 'post:/v1/documents';
  const requestHash = await createIdempotencyHash({
    routeKey,
    ownerSub: user.subject,
    payload: body
  });

  let idempotencyRecordId: string | null = null;

  try {
    const supabase = new SupabaseRestClient(c);
    const idempotency = await beginIdempotency({
      supabase,
      env: c.env,
      ownerSub: user.subject,
      routeKey,
      idempotencyKey,
      requestHash
    });

    if (idempotency.kind === 'conflict') {
      return failure(
        c,
        {
          code: 'idempotency_conflict',
          message: 'Idempotency-Key already used with a different request payload'
        },
        409
      );
    }
    if (idempotency.kind === 'in_progress') {
      return failure(
        c,
        {
          code: 'idempotency_in_progress',
          message: 'A request with this Idempotency-Key is already being processed'
        },
        409
      );
    }
    if (idempotency.kind === 'replay') {
      return replayIdempotentResult(c, idempotency);
    }
    idempotencyRecordId = idempotency.recordId;

    const createdDocument = await supabase.insertOne<DocumentRecord>('documents', {
      owner_sub: user.subject,
      storage_key: storageKey,
      file_name: asNonEmpty(body.file_name),
      mime_type: asNonEmpty(body.mime_type),
      source: asNonEmpty(body.source) ?? 'upload',
      status: 'queued'
    });

    const extractionJob = await supabase.insertOne<ExtractionJobRecord>('extraction_jobs', {
      document_id: createdDocument.id,
      status: 'queued',
      provider: 'modal'
    });

    const patchedDocument = await supabase.updateOne<DocumentRecord>(
      'documents',
      { id: createdDocument.id },
      {
        extraction_job_id: extractionJob.id,
        updated_at: new Date().toISOString()
      }
    );

    const dispatchResult = await dispatchExtractionToModal({
      c,
      supabase,
      document: {
        ...createdDocument,
        ...(patchedDocument ?? {})
      },
      extractionJob
    });

    const responseData = {
      ...createdDocument,
      extraction_job_id: extractionJob.id,
      extraction_job_status: dispatchResult.extractionJobStatus,
      external_job_id: dispatchResult.externalJobId,
      ...(patchedDocument ?? {})
    };

    if (idempotencyRecordId) {
      await finalizeIdempotency({
        supabase,
        env: c.env,
        recordId: idempotencyRecordId,
        status: 201,
        data: responseData,
        error: null
      });
    }

    return success(
      c,
      responseData,
      201
    );
  } catch (error) {
    if (error instanceof ModelScoringError) {
      const responseError: ApiErrorPayload = { code: error.code, message: error.message };
      if (idempotencyRecordId) {
        const supabase = new SupabaseRestClient(c);
        await finalizeIdempotency({
          supabase,
          env: c.env,
          recordId: idempotencyRecordId,
          status: error.status,
          data: null,
          error: responseError
        });
      }
      return failure(c, responseError, error.status);
    }

    if (error instanceof SupabaseError) {
      const status = toApiStatus(error.status);
      const responseError: ApiErrorPayload = { code: 'supabase_error', message: error.message };
      if (idempotencyRecordId && status < 500) {
        const supabase = new SupabaseRestClient(c);
        await finalizeIdempotency({
          supabase,
          env: c.env,
          recordId: idempotencyRecordId,
          status,
          data: null,
          error: responseError
        });
      } else if (status >= 500) {
        await abandonIdempotencyIfNeeded(c, idempotencyRecordId);
      }
      return failure(c, responseError, status);
    }
    await abandonIdempotencyIfNeeded(c, idempotencyRecordId);
    return failure(c, { code: 'internal_error', message: 'Failed to create document' }, 500);
  }
});

routes.get('/documents/:id', requireUserAuth, async (c) => {
  const user = c.get('authUser');
  const documentId = c.req.param('id');

  try {
    const supabase = new SupabaseRestClient(c);
    const document = await supabase.selectOne<DocumentRecord>('documents', { id: documentId });
    if (!document) {
      return failure(c, { code: 'not_found', message: 'Document not found' }, 404);
    }

    const userIsAdmin = isAdmin(c.env, user.roles);
    if (!userIsAdmin && (!user.subject || user.subject !== document.owner_sub)) {
      return failure(c, { code: 'forbidden', message: 'You cannot access this document' }, 403);
    }

    return success(c, document, 200);
  } catch (error) {
    if (error instanceof SupabaseError) {
      return failure(c, { code: 'supabase_error', message: error.message }, toApiStatus(error.status));
    }
    return failure(c, { code: 'internal_error', message: 'Failed to fetch document' }, 500);
  }
});

routes.get('/extraction-jobs/:id', requireUserAuth, async (c) => {
  const user = c.get('authUser');
  const extractionJobId = c.req.param('id');

  try {
    const supabase = new SupabaseRestClient(c);
    const extractionJob = await supabase.selectOne<ExtractionJobRecord>('extraction_jobs', {
      id: extractionJobId
    });
    if (!extractionJob) {
      return failure(c, { code: 'not_found', message: 'Extraction job not found' }, 404);
    }

    const document = await supabase.selectOne<DocumentRecord>('documents', {
      id: extractionJob.document_id
    });
    if (!document) {
      return failure(c, { code: 'not_found', message: 'Document not found' }, 404);
    }

    const userIsAdmin = isAdmin(c.env, user.roles);
    if (!userIsAdmin && (!user.subject || user.subject !== document.owner_sub)) {
      return failure(c, { code: 'forbidden', message: 'You cannot access this extraction job' }, 403);
    }

    return success(
      c,
      {
        id: extractionJob.id,
        document_id: extractionJob.document_id,
        status: extractionJob.status,
        external_job_id: extractionJob.external_job_id ?? null,
        error_message: extractionJob.error_message ?? null,
        document_status: document.status ?? null
      },
      200
    );
  } catch (error) {
    if (error instanceof SupabaseError) {
      return failure(c, { code: 'supabase_error', message: error.message }, toApiStatus(error.status));
    }
    return failure(c, { code: 'internal_error', message: 'Failed to fetch extraction job' }, 500);
  }
});

routes.post('/extraction-jobs/:id/callback', async (c) => {
  const callbackSecret = getCallbackSecret(c.env);
  const providedSecret = asNonEmpty(c.req.header('X-Callback-Secret'));

  if (!callbackSecret || providedSecret !== callbackSecret) {
    return failure(c, { code: 'unauthorized', message: 'Invalid callback secret' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return failure(c, { code: 'invalid_request', message: 'Invalid JSON body' }, 400);
  }

  const extractionJobId = c.req.param('id');
  const status = normalizeJobStatus(body.status);
  if (!status) {
    return failure(c, { code: 'invalid_request', message: 'status is required' }, 400);
  }

  const externalJobId = asNonEmpty(body.external_job_id);
  const errorMessage = asNonEmpty(body.error_message);
  const features =
    body.features && typeof body.features === 'object' && !Array.isArray(body.features)
      ? (body.features as Record<string, unknown>)
      : null;

  try {
    const supabase = new SupabaseRestClient(c);
    const extractionJob = await supabase.selectOne<ExtractionJobRecord>('extraction_jobs', {
      id: extractionJobId
    });
    if (!extractionJob) {
      return failure(c, { code: 'not_found', message: 'Extraction job not found' }, 404);
    }

    const document = await supabase.selectOne<DocumentRecord>('documents', {
      id: extractionJob.document_id
    });
    if (!document) {
      return failure(c, { code: 'not_found', message: 'Document not found' }, 404);
    }

    if (status === 'completed' && !features) {
      return failure(
        c,
        { code: 'invalid_request', message: 'features are required when status is completed' },
        400
      );
    }

    const nowIso = new Date().toISOString();
    const patchedJob = await supabase.updateOne<ExtractionJobRecord>(
      'extraction_jobs',
      { id: extractionJob.id },
      {
        status,
        external_job_id: externalJobId ?? extractionJob.external_job_id ?? null,
        error_message: status === 'failed' ? errorMessage : null,
        started_at: status === 'processing' ? nowIso : extractionJob.started_at ?? null,
        finished_at: status === 'completed' || status === 'failed' ? nowIso : null
      }
    );

    if (status === 'completed' && features) {
      const existingFeature = await supabase.selectOne<ExtractedFeatureRecord>('extracted_features', {
        document_id: document.id
      });

      if (existingFeature) {
        await supabase.updateOne<ExtractedFeatureRecord>(
          'extracted_features',
          { id: existingFeature.id },
          {
            payload: features
          }
        );
      } else {
        await supabase.insertOne<ExtractedFeatureRecord>('extracted_features', {
          document_id: document.id,
          owner_sub: document.owner_sub,
          payload: features
        });
      }
    }

    const documentStatus =
      status === 'completed' ? 'ready' : status === 'failed' ? 'failed' : status === 'processing' ? 'processing' : 'queued';

    const patchedDocument = await supabase.updateOne<DocumentRecord>(
      'documents',
      { id: document.id },
      {
        status: documentStatus,
        error_message: status === 'failed' ? errorMessage : null
      }
    );

    return success(
      c,
      {
        id: patchedJob?.id ?? extractionJob.id,
        document_id: extractionJob.document_id,
        status: patchedJob?.status ?? status,
        external_job_id: patchedJob?.external_job_id ?? externalJobId ?? null,
        document_status: patchedDocument?.status ?? documentStatus
      },
      200
    );
  } catch (error) {
    if (error instanceof SupabaseError) {
      return failure(c, { code: 'supabase_error', message: error.message }, toApiStatus(error.status));
    }
    return failure(c, { code: 'internal_error', message: 'Failed to process extraction callback' }, 500);
  }
});

routes.post('/assessments', requireUserAuth, async (c) => {
  const user = c.get('authUser');
  if (!user.subject) {
    return failure(c, { code: 'unauthorized', message: 'Authentication required' }, 401);
  }

  const idempotencyKey = readIdempotencyKey(c.req.header('Idempotency-Key'));
  if (!idempotencyKey) {
    return failure(c, { code: 'missing_idempotency_key', message: 'Idempotency-Key header is required' }, 400);
  }

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return failure(c, { code: 'invalid_request', message: 'Invalid JSON body' }, 400);
  }

  const documentId = asNonEmpty(body.document_id);
  if (!documentId) {
    return failure(c, { code: 'invalid_request', message: 'document_id is required' }, 400);
  }

  const routeKey = 'post:/v1/assessments';
  const requestHash = await createIdempotencyHash({
    routeKey,
    ownerSub: user.subject,
    payload: body
  });

  let idempotencyRecordId: string | null = null;

  try {
    const supabase = new SupabaseRestClient(c);
    const idempotency = await beginIdempotency({
      supabase,
      env: c.env,
      ownerSub: user.subject,
      routeKey,
      idempotencyKey,
      requestHash
    });

    if (idempotency.kind === 'conflict') {
      return failure(
        c,
        {
          code: 'idempotency_conflict',
          message: 'Idempotency-Key already used with a different request payload'
        },
        409
      );
    }
    if (idempotency.kind === 'in_progress') {
      return failure(
        c,
        {
          code: 'idempotency_in_progress',
          message: 'A request with this Idempotency-Key is already being processed'
        },
        409
      );
    }
    if (idempotency.kind === 'replay') {
      return replayIdempotentResult(c, idempotency);
    }
    idempotencyRecordId = idempotency.recordId;

    const document = await supabase.selectOne<DocumentRecord>('documents', { id: documentId });
    if (!document) {
      const responseError: ApiErrorPayload = { code: 'not_found', message: 'Document not found' };
      if (idempotencyRecordId) {
        await finalizeIdempotency({
          supabase,
          env: c.env,
          recordId: idempotencyRecordId,
          status: 404,
          data: null,
          error: responseError
        });
      }
      return failure(c, responseError, 404);
    }
    if (document.owner_sub !== user.subject) {
      const responseError: ApiErrorPayload = {
        code: 'forbidden',
        message: 'You cannot assess this document'
      };
      if (idempotencyRecordId) {
        await finalizeIdempotency({
          supabase,
          env: c.env,
          recordId: idempotencyRecordId,
          status: 403,
          data: null,
          error: responseError
        });
      }
      return failure(c, responseError, 403);
    }

    let extractedFeature = await supabase.selectOne<ExtractedFeatureRecord>('extracted_features', {
      document_id: documentId
    });

    const inputFeatures =
      body.features && typeof body.features === 'object' && !Array.isArray(body.features)
        ? (body.features as Record<string, unknown>)
        : null;
    const statementPayload = buildStatementFeatureRequest(body);
    let resolvedFeatures = inputFeatures;

    if (!resolvedFeatures && statementPayload) {
      const extractedFromStatement = await extractFeaturesFromStatement(c, statementPayload);
      if (extractedFromStatement) {
        resolvedFeatures = extractedFromStatement;
      }
    }

    if (!extractedFeature && resolvedFeatures) {
      extractedFeature = await supabase.insertOne<ExtractedFeatureRecord>('extracted_features', {
        document_id: documentId,
        owner_sub: user.subject,
        payload: resolvedFeatures
      });
    }

    if (!extractedFeature) {
      const responseError: ApiErrorPayload = {
        code: 'invalid_request',
        message:
          'No extracted feature payload found. Provide features, include statement transactions, or run extraction first.'
      };
      if (idempotencyRecordId) {
        await finalizeIdempotency({
          supabase,
          env: c.env,
          recordId: idempotencyRecordId,
          status: 400,
          data: null,
          error: responseError
        });
      }
      return failure(c, responseError, 400);
    }

    const scoring = await scoreAssessment(c, extractedFeature.payload);
    const threshold = getThreshold(c.env);

    const responseData = await supabase.insertOne<AssessmentRecord>('assessments', {
      owner_sub: user.subject,
      document_id: documentId,
      extracted_feature_id: extractedFeature.id,
      risk_probability: scoring.riskProbability,
      auto_decision: scoring.decision,
      final_decision: scoring.decision,
      decision_source: 'auto',
      threshold,
      model_version: scoring.modelVersion
    });

    if (idempotencyRecordId) {
      await finalizeIdempotency({
        supabase,
        env: c.env,
        recordId: idempotencyRecordId,
        status: 201,
        data: responseData,
        error: null
      });
    }

    return success(c, responseData, 201);
  } catch (error) {
    if (error instanceof SupabaseError) {
      const status = toApiStatus(error.status);
      const responseError: ApiErrorPayload = { code: 'supabase_error', message: error.message };
      if (idempotencyRecordId && status < 500) {
        const supabase = new SupabaseRestClient(c);
        await finalizeIdempotency({
          supabase,
          env: c.env,
          recordId: idempotencyRecordId,
          status,
          data: null,
          error: responseError
        });
      } else if (status >= 500) {
        await abandonIdempotencyIfNeeded(c, idempotencyRecordId);
      }
      return failure(c, responseError, status);
    }
    await abandonIdempotencyIfNeeded(c, idempotencyRecordId);
    return failure(c, { code: 'internal_error', message: 'Failed to create assessment' }, 500);
  }
});

routes.get('/assessments/me', requireUserAuth, async (c) => {
  const user = c.get('authUser');
  if (!user.subject) {
    return failure(c, { code: 'unauthorized', message: 'Authentication required' }, 401);
  }

  const page = parsePage(c.req.query('page'));
  const limit = parseLimit(c.req.query('limit'));
  const offset = (page - 1) * limit;

  try {
    const supabase = new SupabaseRestClient(c);
    const { items, total } = await supabase.selectManyWithCount<AssessmentRecord>('assessments', {
      filters: { owner_sub: user.subject },
      order: 'created_at.desc',
      limit,
      offset
    });

    return success(
      c,
      {
        page,
        limit,
        total,
        total_pages: total === 0 ? 1 : Math.ceil(total / limit),
        items
      },
      200
    );
  } catch (error) {
    if (error instanceof SupabaseError) {
      return failure(c, { code: 'supabase_error', message: error.message }, toApiStatus(error.status));
    }
    return failure(c, { code: 'internal_error', message: 'Failed to list assessments' }, 500);
  }
});

routes.get('/admin/assessments', requireAdminAuth, async (c) => {
  const page = parsePage(c.req.query('page'));
  const limit = parseLimit(c.req.query('limit'));
  const offset = (page - 1) * limit;
  const status = normalizeDecision(c.req.query('status'));
  const ownerSub = asNonEmpty(c.req.query('owner_sub'));
  const reviewedBy = asNonEmpty(c.req.query('reviewed_by'));
  const decisionSource = normalizeDecisionSource(c.req.query('decision_source'));
  const q = sanitizeSearchTerm(c.req.query('q'));

  const filters: QueryFilters = {};
  if (status) {
    filters.final_decision = status;
  }
  if (ownerSub) {
    filters.owner_sub = ownerSub;
  }
  if (reviewedBy) {
    filters.reviewed_by = { op: 'ilike', value: `*${reviewedBy}*` };
  }
  if (decisionSource) {
    filters.decision_source = decisionSource;
  }

  const query: SupabaseQueryParams = {};
  if (q) {
    const searchPattern = `*${q}*`;
    query.or = `(owner_sub.ilike.${searchPattern},reviewed_by.ilike.${searchPattern},override_reason.ilike.${searchPattern})`;
  }

  try {
    const supabase = new SupabaseRestClient(c);
    const { items, total } = await supabase.selectManyWithCount<AssessmentRecord>('assessments', {
      filters,
      order: 'created_at.desc',
      limit,
      offset,
      query
    });

    return success(
      c,
      {
        page,
        limit,
        total,
        total_pages: total === 0 ? 1 : Math.ceil(total / limit),
        items
      },
      200
    );
  } catch (error) {
    if (error instanceof SupabaseError) {
      return failure(c, { code: 'supabase_error', message: error.message }, toApiStatus(error.status));
    }
    return failure(c, { code: 'internal_error', message: 'Failed to list admin assessments' }, 500);
  }
});

routes.post('/admin/assessments/:id/override', requireAdminAuth, async (c) => {
  const user = c.get('authUser');
  const assessmentId = c.req.param('id');

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return failure(c, { code: 'invalid_request', message: 'Invalid JSON body' }, 400);
  }

  const decision = normalizeDecision(body.decision);
  const reason = asNonEmpty(body.reason);
  if (!decision || !reason) {
    return failure(c, { code: 'invalid_request', message: 'decision and reason are required' }, 400);
  }

  try {
    const supabase = new SupabaseRestClient(c);
    const existing = await supabase.selectOne<AssessmentRecord>('assessments', { id: assessmentId });
    if (!existing) {
      return failure(c, { code: 'not_found', message: 'Assessment not found' }, 404);
    }

    const reviewer = user.email ?? user.subject;
    const updated = await supabase.updateOne<AssessmentRecord>(
      'assessments',
      { id: assessmentId },
      {
        final_decision: decision,
        decision_source: 'manual_override',
        reviewed_by: reviewer,
        override_reason: reason,
        updated_at: new Date().toISOString()
      }
    );
    if (!updated) {
      return failure(c, { code: 'not_found', message: 'Assessment not found' }, 404);
    }

    await supabase.insertOne('assessment_overrides', {
      assessment_id: assessmentId,
      actor_sub: user.subject,
      actor_email: user.email,
      decision,
      reason
    });

    await supabase.insertOne('audit_logs', {
      actor: reviewer ?? 'admin',
      action: 'Manual override',
      details: `Assessment ${assessmentId} manually set to ${decision}: ${reason}`,
      status: 'warning',
      entity_id: assessmentId,
      source: 'manual_override'
    });

    return success(c, updated, 200);
  } catch (error) {
    if (error instanceof SupabaseError) {
      return failure(c, { code: 'supabase_error', message: error.message }, toApiStatus(error.status));
    }
    return failure(c, { code: 'internal_error', message: 'Failed to override assessment' }, 500);
  }
});

export default routes;
