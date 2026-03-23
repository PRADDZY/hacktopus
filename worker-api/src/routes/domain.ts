import { Hono } from 'hono';
import { requireAdminAuth, requireUserAuth } from '../auth';
import { failure, success, toApiStatus } from '../http';
import { SupabaseError, SupabaseRestClient } from '../supabase';
import type { AppEnv } from '../types';

type Decision = 'Approve' | 'Decline';

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
  decision_source: 'auto' | 'manual_override';
  reviewed_by?: string | null;
  override_reason?: string | null;
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
  return Math.min(100, Math.floor(parsed));
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

const computeRiskProbability = (payload: Record<string, unknown>): number => {
  const read = (key: string, fallback: number): number => {
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
    return fallback;
  };

  const stress = clamp(read('stress_index', 0.5));
  const burden = clamp(read('total_burden_ratio', 0.5));
  const buffer = clamp(read('buffer_ratio', 0.2));
  const negBalanceDays = clamp(read('neg_balance_days_30d', 0) / 30);

  const probability = stress * 0.35 + burden * 0.4 + (1 - buffer) * 0.15 + negBalanceDays * 0.1;
  return Number(clamp(probability).toFixed(6));
};

const toDecision = (riskProbability: number, threshold: number): Decision =>
  riskProbability >= threshold ? 'Decline' : 'Approve';

routes.post('/documents', requireUserAuth, async (c) => {
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

  const storageKey = asNonEmpty(body.storage_key);
  if (!storageKey) {
    return failure(c, { code: 'invalid_request', message: 'storage_key is required' }, 400);
  }

  try {
    const supabase = new SupabaseRestClient(c);
    const createdDocument = await supabase.insertOne<DocumentRecord>('documents', {
      owner_sub: user.subject,
      storage_key: storageKey,
      file_name: asNonEmpty(body.file_name),
      mime_type: asNonEmpty(body.mime_type),
      source: asNonEmpty(body.source) ?? 'upload',
      status: 'queued'
    });

    const extractionJob = await supabase.insertOne<{ id: string; status: string }>('extraction_jobs', {
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

    return success(
      c,
      {
        ...createdDocument,
        extraction_job_id: extractionJob.id,
        extraction_job_status: extractionJob.status,
        ...(patchedDocument ?? {})
      },
      201
    );
  } catch (error) {
    if (error instanceof SupabaseError) {
      return failure(c, { code: 'supabase_error', message: error.message }, toApiStatus(error.status));
    }
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

routes.post('/assessments', requireUserAuth, async (c) => {
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

  const documentId = asNonEmpty(body.document_id);
  if (!documentId) {
    return failure(c, { code: 'invalid_request', message: 'document_id is required' }, 400);
  }

  try {
    const supabase = new SupabaseRestClient(c);
    const document = await supabase.selectOne<DocumentRecord>('documents', { id: documentId });
    if (!document) {
      return failure(c, { code: 'not_found', message: 'Document not found' }, 404);
    }
    if (document.owner_sub !== user.subject) {
      return failure(c, { code: 'forbidden', message: 'You cannot assess this document' }, 403);
    }

    let extractedFeature = await supabase.selectOne<ExtractedFeatureRecord>('extracted_features', {
      document_id: documentId
    });

    const inputFeatures =
      body.features && typeof body.features === 'object' && !Array.isArray(body.features)
        ? (body.features as Record<string, unknown>)
        : null;

    if (!extractedFeature && inputFeatures) {
      extractedFeature = await supabase.insertOne<ExtractedFeatureRecord>('extracted_features', {
        document_id: documentId,
        owner_sub: user.subject,
        payload: inputFeatures
      });
    }

    if (!extractedFeature) {
      return failure(
        c,
        {
          code: 'invalid_request',
          message: 'No extracted feature payload found. Provide features or run extraction first.'
        },
        400
      );
    }

    const threshold = getThreshold(c.env);
    const riskProbability = computeRiskProbability(extractedFeature.payload);
    const autoDecision = toDecision(riskProbability, threshold);

    const assessment = await supabase.insertOne<AssessmentRecord>('assessments', {
      owner_sub: user.subject,
      document_id: documentId,
      extracted_feature_id: extractedFeature.id,
      risk_probability: riskProbability,
      auto_decision: autoDecision,
      final_decision: autoDecision,
      decision_source: 'auto',
      threshold,
      model_version: getModelVersion(c.env)
    });

    return success(c, assessment, 201);
  } catch (error) {
    if (error instanceof SupabaseError) {
      return failure(c, { code: 'supabase_error', message: error.message }, toApiStatus(error.status));
    }
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
    const items = await supabase.selectMany<AssessmentRecord>('assessments', {
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
        total: items.length,
        total_pages: items.length === 0 ? 1 : Math.ceil(items.length / limit),
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

  try {
    const supabase = new SupabaseRestClient(c);
    const items = await supabase.selectMany<AssessmentRecord>('assessments', {
      filters: status ? { final_decision: status } : {},
      order: 'created_at.desc',
      limit,
      offset
    });

    return success(
      c,
      {
        page,
        limit,
        total: items.length,
        total_pages: items.length === 0 ? 1 : Math.ceil(items.length / limit),
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
