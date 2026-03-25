import { SignJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { createIdempotencyHash } from '../src/idempotency';
import type { AppEnv } from '../src/types';

const ISSUER = 'https://auth.example.com/';
const AUDIENCE = 'fairlens-api';
const SHARED_SECRET = 'unit-test-secret';

const createEnv = (overrides: Partial<AppEnv['Bindings']> = {}): AppEnv['Bindings'] => ({
  AUTH_REQUIRED: 'true',
  AUTH_ISSUER_BASE_URL: ISSUER,
  AUTH_AUDIENCE: AUDIENCE,
  AUTH_SHARED_SECRET: SHARED_SECRET,
  AUTH_JWT_ALGORITHMS: 'HS256',
  AUTH_ROLE_CLAIM: 'roles',
  AUTH_ADMIN_ROLES: 'admin',
  SUPABASE_URL: 'https://supabase.example.co',
  SUPABASE_SERVICE_ROLE_KEY: 'supabase-service-role',
  ...overrides
});

const signToken = async (
  roles: string[] = [],
  subject = 'auth0|user-123',
  email = 'tester@example.com'
): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({
    roles,
    email
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(subject)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(new TextEncoder().encode(SHARED_SECRET));
};

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Worker domain routes', () => {
  it('blocks document creation when token is missing', async () => {
    const response = await app.request(
      '/v1/documents',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_key: 'uploads/a.pdf' })
      },
      createEnv()
    );
    expect(response.status).toBe(401);
  });

  it('requires idempotency key for document creation', async () => {
    const token = await signToken(['user']);

    const response = await app.request(
      '/v1/documents',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          storage_key: 'uploads/a.pdf',
          file_name: 'a.pdf'
        })
      },
      createEnv()
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as {
      data: null;
      error: { code: string; message: string };
    };
    expect(payload.data).toBeNull();
    expect(payload.error).toEqual({
      code: 'missing_idempotency_key',
      message: 'Idempotency-Key header is required'
    });
  });

  it('creates document and extraction job for authenticated user', async () => {
    const token = await signToken(['user']);

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = (init?.method || 'GET').toUpperCase();

      if (url.pathname.endsWith('/api_idempotency_keys') && method === 'POST') {
        return jsonResponse([
          {
            id: 'idem-doc-1',
            owner_sub: 'auth0|user-123',
            route_key: 'post:/v1/documents',
            idempotency_key: 'idem-doc-1',
            request_hash: 'hash-doc-1',
            state: 'in_progress'
          }
        ]);
      }

      if (url.pathname.endsWith('/documents') && method === 'POST') {
        return jsonResponse([
          {
            id: 'doc-1',
            owner_sub: 'auth0|user-123',
            storage_key: 'uploads/a.pdf',
            status: 'queued',
            extraction_job_id: null
          }
        ]);
      }

      if (url.pathname.endsWith('/extraction_jobs') && method === 'POST') {
        return jsonResponse([
          {
            id: 'job-1',
            document_id: 'doc-1',
            status: 'queued'
          }
        ]);
      }

      if (url.pathname.endsWith('/documents') && method === 'PATCH') {
        return jsonResponse([
          {
            id: 'doc-1',
            owner_sub: 'auth0|user-123',
            storage_key: 'uploads/a.pdf',
            status: 'queued',
            extraction_job_id: 'job-1'
          }
        ]);
      }

      if (url.pathname.endsWith('/api_idempotency_keys') && method === 'PATCH') {
        return jsonResponse([
          {
            id: 'idem-doc-1',
            state: 'completed',
            response_status: 201
          }
        ]);
      }

      return jsonResponse({ message: `Unexpected request ${method} ${url.pathname}` }, 500);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await app.request(
      '/v1/documents',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': 'idem-doc-1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          storage_key: 'uploads/a.pdf',
          file_name: 'a.pdf',
          mime_type: 'application/pdf',
          source: 'upload'
        })
      },
      createEnv()
    );

    expect(response.status).toBe(201);
    const payload = (await response.json()) as {
      error: unknown;
      data: { id: string; extraction_job_id: string | null };
    };
    expect(payload.error).toBeNull();
    expect(payload.data.id).toBe('doc-1');
    expect(payload.data.extraction_job_id).toBe('job-1');
  });

  it('replays document creation result for a completed idempotency key', async () => {
    const token = await signToken(['user']);

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = (init?.method || 'GET').toUpperCase();

      if (url.pathname.endsWith('/api_idempotency_keys') && method === 'POST') {
        return jsonResponse({ message: 'duplicate key value violates unique constraint' }, 409);
      }

      if (url.pathname.endsWith('/api_idempotency_keys') && method === 'GET') {
        return jsonResponse([
          {
            id: 'idem-doc-replay',
            owner_sub: 'auth0|user-123',
            route_key: 'post:/v1/documents',
            idempotency_key: 'idem-doc-replay',
            request_hash: await createIdempotencyHash({
              routeKey: 'post:/v1/documents',
              ownerSub: 'auth0|user-123',
              payload: {
                storage_key: 'uploads/replay.pdf',
                source: 'upload'
              }
            }),
            state: 'completed',
            response_status: 201,
            response_data: {
              id: 'doc-replay',
              owner_sub: 'auth0|user-123',
              storage_key: 'uploads/replay.pdf'
            },
            response_error: null
          }
        ]);
      }

      return jsonResponse({ message: `Unexpected request ${method} ${url.pathname}` }, 500);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await app.request(
      '/v1/documents',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': 'idem-doc-replay',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          storage_key: 'uploads/replay.pdf',
          source: 'upload'
        })
      },
      createEnv()
    );

    expect(response.status).toBe(201);
    const payload = (await response.json()) as {
      error: unknown;
      data: { id: string; storage_key: string };
    };
    expect(payload.error).toBeNull();
    expect(payload.data.id).toBe('doc-replay');
    expect(payload.data.storage_key).toBe('uploads/replay.pdf');
  });

  it('returns idempotency conflict when key is reused with a different payload', async () => {
    const token = await signToken(['user']);

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = (init?.method || 'GET').toUpperCase();

      if (url.pathname.endsWith('/api_idempotency_keys') && method === 'POST') {
        return jsonResponse({ message: 'duplicate key value violates unique constraint' }, 409);
      }

      if (url.pathname.endsWith('/api_idempotency_keys') && method === 'GET') {
        return jsonResponse([
          {
            id: 'idem-doc-conflict',
            owner_sub: 'auth0|user-123',
            route_key: 'post:/v1/documents',
            idempotency_key: 'idem-doc-conflict',
            request_hash: 'different-request-hash',
            state: 'completed',
            response_status: 201,
            response_data: {
              id: 'doc-old'
            },
            response_error: null
          }
        ]);
      }

      return jsonResponse({ message: `Unexpected request ${method} ${url.pathname}` }, 500);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await app.request(
      '/v1/documents',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': 'idem-doc-conflict',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          storage_key: 'uploads/new.pdf',
          source: 'upload'
        })
      },
      createEnv()
    );

    expect(response.status).toBe(409);
    const payload = (await response.json()) as {
      data: null;
      error: { code: string; message: string };
    };
    expect(payload.data).toBeNull();
    expect(payload.error.code).toBe('idempotency_conflict');
  });

  it('returns idempotency in-progress when duplicate request is still running', async () => {
    const token = await signToken(['user']);
    const requestPayload = {
      storage_key: 'uploads/in-progress.pdf',
      source: 'upload'
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = (init?.method || 'GET').toUpperCase();

      if (url.pathname.endsWith('/api_idempotency_keys') && method === 'POST') {
        return jsonResponse({ message: 'duplicate key value violates unique constraint' }, 409);
      }

      if (url.pathname.endsWith('/api_idempotency_keys') && method === 'GET') {
        return jsonResponse([
          {
            id: 'idem-doc-pending',
            owner_sub: 'auth0|user-123',
            route_key: 'post:/v1/documents',
            idempotency_key: 'idem-doc-pending',
            request_hash: await createIdempotencyHash({
              routeKey: 'post:/v1/documents',
              ownerSub: 'auth0|user-123',
              payload: requestPayload
            }),
            state: 'in_progress',
            response_status: null,
            response_data: null,
            response_error: null
          }
        ]);
      }

      return jsonResponse({ message: `Unexpected request ${method} ${url.pathname}` }, 500);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await app.request(
      '/v1/documents',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': 'idem-doc-pending',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      },
      createEnv()
    );

    expect(response.status).toBe(409);
    const payload = (await response.json()) as {
      data: null;
      error: { code: string; message: string };
    };
    expect(payload.data).toBeNull();
    expect(payload.error.code).toBe('idempotency_in_progress');
  });

  it('blocks document access for non-owner user', async () => {
    const token = await signToken(['user']);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse([
          {
            id: 'doc-2',
            owner_sub: 'auth0|another-user',
            storage_key: 'uploads/b.pdf',
            status: 'queued'
          }
        ])
      )
    );

    const response = await app.request(
      '/v1/documents/doc-2',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      createEnv()
    );
    expect(response.status).toBe(403);
  });

  it('creates assessment from provided features', async () => {
    const token = await signToken(['user']);

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = (init?.method || 'GET').toUpperCase();

      if (url.pathname.endsWith('/api_idempotency_keys') && method === 'POST') {
        return jsonResponse([
          {
            id: 'idem-assessment-1',
            owner_sub: 'auth0|user-123',
            route_key: 'post:/v1/assessments',
            idempotency_key: 'idem-assessment-1',
            request_hash: 'hash-asm-1',
            state: 'in_progress'
          }
        ]);
      }

      if (url.pathname.endsWith('/documents') && method === 'GET') {
        return jsonResponse([
          {
            id: 'doc-3',
            owner_sub: 'auth0|user-123',
            storage_key: 'uploads/c.pdf',
            status: 'ready'
          }
        ]);
      }

      if (url.pathname.endsWith('/extracted_features') && method === 'GET') {
        return jsonResponse([]);
      }

      if (url.pathname.endsWith('/extracted_features') && method === 'POST') {
        return jsonResponse([
          {
            id: 'feat-1',
            document_id: 'doc-3',
            owner_sub: 'auth0|user-123',
            payload: {
              stress_index: 0.7,
              total_burden_ratio: 0.6,
              buffer_ratio: 0.1,
              neg_balance_days_30d: 4
            }
          }
        ]);
      }

      if (url.pathname.endsWith('/assessments') && method === 'POST') {
        return jsonResponse([
          {
            id: 'asm-1',
            owner_sub: 'auth0|user-123',
            document_id: 'doc-3',
            extracted_feature_id: 'feat-1',
            risk_probability: 0.62,
            auto_decision: 'Decline',
            final_decision: 'Decline',
            decision_source: 'auto'
          }
        ]);
      }

      if (url.pathname.endsWith('/api_idempotency_keys') && method === 'PATCH') {
        return jsonResponse([
          {
            id: 'idem-assessment-1',
            state: 'completed',
            response_status: 201
          }
        ]);
      }

      return jsonResponse({ message: `Unexpected request ${method} ${url.pathname}` }, 500);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await app.request(
      '/v1/assessments',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': 'idem-assessment-1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          document_id: 'doc-3',
          features: {
            stress_index: 0.7,
            total_burden_ratio: 0.6,
            buffer_ratio: 0.1,
            neg_balance_days_30d: 4
          }
        })
      },
      createEnv()
    );

    expect(response.status).toBe(201);
    const payload = (await response.json()) as {
      error: unknown;
      data: { id: string; final_decision: string };
    };
    expect(payload.error).toBeNull();
    expect(payload.data.id).toBe('asm-1');
    expect(payload.data.final_decision).toBe('Decline');
  });

  it('creates assessment from statement payload via feature endpoint', async () => {
    const token = await signToken(['user']);

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = (init?.method || 'GET').toUpperCase();

      if (url.pathname.endsWith('/api_idempotency_keys') && method === 'POST') {
        return jsonResponse([
          {
            id: 'idem-assessment-statement-1',
            owner_sub: 'auth0|user-123',
            route_key: 'post:/v1/assessments',
            idempotency_key: 'idem-assessment-statement-1',
            request_hash: 'hash-asm-statement-1',
            state: 'in_progress'
          }
        ]);
      }

      if (url.pathname.endsWith('/documents') && method === 'GET') {
        return jsonResponse([
          {
            id: 'doc-4',
            owner_sub: 'auth0|user-123',
            storage_key: 'uploads/statement.pdf',
            status: 'ready'
          }
        ]);
      }

      if (url.pathname.endsWith('/extracted_features') && method === 'GET') {
        return jsonResponse([]);
      }

      if (url.hostname === 'ml.example.com' && url.pathname.endsWith('/featureize/statement') && method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        expect(body.statement_window_days).toBe(90);
        return jsonResponse({
          schema_version: 'risk-v2.0.0',
          feature_schema_version: 'statement-feature-v1',
          features: {
            segment: 'gig_worker',
            monthly_inflow: 70000,
            monthly_outflow: 41000,
            inflow_volatility_90d: 0.21,
            outflow_volatility_90d: 0.27,
            deposit_count_30d: 5,
            days_since_last_income: 2,
            avg_balance_30d: 9800,
            min_balance_30d: 1200,
            negative_balance_days_30d: 1,
            essential_spend_ratio: 0.62,
            active_loan_count: 1,
            monthly_installment_burden: 7800,
            purchase_amount: 24000,
            tenure_weeks: 24,
            purchase_to_inflow_ratio: 0.342857,
            installment_to_inflow_ratio: 0.111429,
            total_burden_ratio: 0.697143,
            buffer_ratio: 0.017143,
            stress_index: 0.54
          }
        });
      }

      if (url.pathname.endsWith('/extracted_features') && method === 'POST') {
        return jsonResponse([
          {
            id: 'feat-statement-1',
            document_id: 'doc-4',
            owner_sub: 'auth0|user-123',
            payload: {
              segment: 'gig_worker',
              stress_index: 0.54,
              total_burden_ratio: 0.697143,
              buffer_ratio: 0.017143,
              negative_balance_days_30d: 1
            }
          }
        ]);
      }

      if (url.pathname.endsWith('/assessments') && method === 'POST') {
        return jsonResponse([
          {
            id: 'asm-statement-1',
            owner_sub: 'auth0|user-123',
            document_id: 'doc-4',
            extracted_feature_id: 'feat-statement-1',
            risk_probability: 0.59,
            auto_decision: 'Decline',
            final_decision: 'Decline',
            decision_source: 'auto'
          }
        ]);
      }

      if (url.pathname.endsWith('/api_idempotency_keys') && method === 'PATCH') {
        return jsonResponse([
          {
            id: 'idem-assessment-statement-1',
            state: 'completed',
            response_status: 201
          }
        ]);
      }

      return jsonResponse({ message: `Unexpected request ${method} ${url.pathname}` }, 500);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await app.request(
      '/v1/assessments',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': 'idem-assessment-statement-1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          document_id: 'doc-4',
          statement: {
            statement_window_days: 90,
            transactions: [
              { date: '2026-03-01', amount: 52000, direction: 'credit', balance: 8100 },
              { date: '2026-03-03', amount: -11200, direction: 'debit', balance: 6200 }
            ]
          }
        })
      },
      createEnv({
        FEATURE_EXTRACTION_ENDPOINT: 'https://ml.example.com/featureize/statement'
      })
    );

    expect(response.status).toBe(201);
    const payload = (await response.json()) as {
      error: unknown;
      data: { id: string; final_decision: string };
    };
    expect(payload.error).toBeNull();
    expect(payload.data.id).toBe('asm-statement-1');
    expect(payload.data.final_decision).toBe('Decline');
  });

  it('requires idempotency key for assessment creation', async () => {
    const token = await signToken(['user']);

    const response = await app.request(
      '/v1/assessments',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          document_id: 'doc-3',
          features: {
            stress_index: 0.7,
            total_burden_ratio: 0.6,
            buffer_ratio: 0.1,
            neg_balance_days_30d: 4
          }
        })
      },
      createEnv()
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as {
      data: null;
      error: { code: string; message: string };
    };
    expect(payload.data).toBeNull();
    expect(payload.error).toEqual({
      code: 'missing_idempotency_key',
      message: 'Idempotency-Key header is required'
    });
  });

  it('lists current user assessments', async () => {
    const token = await signToken(['user']);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse([
          {
            id: 'asm-2',
            owner_sub: 'auth0|user-123',
            final_decision: 'Approve',
            risk_probability: 0.2
          }
        ])
      )
    );

    const response = await app.request(
      '/v1/assessments/me?page=1&limit=20',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      createEnv()
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      error: unknown;
      data: { items: unknown[]; total: number };
    };
    expect(payload.error).toBeNull();
    expect(payload.data.items).toHaveLength(1);
    expect(payload.data.total).toBe(1);
  });

  it('supports admin filters and returns accurate total count', async () => {
    const token = await signToken(['admin'], 'auth0|admin-1', 'admin@example.com');

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      expect(url.pathname).toContain('/assessments');
      expect(url.searchParams.get('final_decision')).toBe('eq.Approve');
      expect(url.searchParams.get('owner_sub')).toBe('eq.auth0|user-123');
      expect(url.searchParams.get('reviewed_by')).toBe('ilike.*admin@example.com*');
      expect(url.searchParams.get('decision_source')).toBe('eq.manual_override');
      expect(url.searchParams.get('or')).toContain('owner_sub.ilike.*user-123*');

      return new Response(
        JSON.stringify([
          {
            id: 'asm-33',
            owner_sub: 'auth0|user-123',
            final_decision: 'Approve',
            reviewed_by: 'admin@example.com',
            decision_source: 'manual_override'
          }
        ]),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Range': '0-0/42'
          }
        }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await app.request(
      '/v1/admin/assessments?page=1&limit=1&status=Approve&owner_sub=auth0|user-123&reviewed_by=admin@example.com&decision_source=manual_override&q=user-123',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      createEnv()
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: { total: number; total_pages: number; items: unknown[] };
      error: unknown;
    };
    expect(payload.error).toBeNull();
    expect(payload.data.items).toHaveLength(1);
    expect(payload.data.total).toBe(42);
    expect(payload.data.total_pages).toBe(42);
  });

  it('blocks override route for non-admin', async () => {
    const token = await signToken(['user']);

    const response = await app.request(
      '/v1/admin/assessments/asm-3/override',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          decision: 'Approve',
          reason: 'manual review'
        })
      },
      createEnv()
    );

    expect(response.status).toBe(403);
  });

  it('allows admin override and returns updated assessment', async () => {
    const token = await signToken(['admin'], 'auth0|admin-1', 'admin@example.com');

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = (init?.method || 'GET').toUpperCase();

      if (url.pathname.endsWith('/assessments') && method === 'GET') {
        return jsonResponse([
          {
            id: 'asm-4',
            owner_sub: 'auth0|user-123',
            final_decision: 'Decline',
            auto_decision: 'Decline',
            decision_source: 'auto'
          }
        ]);
      }

      if (url.pathname.endsWith('/assessments') && method === 'PATCH') {
        return jsonResponse([
          {
            id: 'asm-4',
            owner_sub: 'auth0|user-123',
            final_decision: 'Approve',
            auto_decision: 'Decline',
            decision_source: 'manual_override',
            reviewed_by: 'admin@example.com',
            override_reason: 'approved after review'
          }
        ]);
      }

      if (url.pathname.endsWith('/assessment_overrides') && method === 'POST') {
        return jsonResponse([{ id: 'ovr-1' }], 201);
      }

      if (url.pathname.endsWith('/audit_logs') && method === 'POST') {
        return jsonResponse([{ id: 77 }], 201);
      }

      return jsonResponse({ message: `Unexpected request ${method} ${url.pathname}` }, 500);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await app.request(
      '/v1/admin/assessments/asm-4/override',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          decision: 'Approve',
          reason: 'approved after review'
        })
      },
      createEnv()
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      error: unknown;
      data: { final_decision: string; decision_source: string };
    };
    expect(payload.error).toBeNull();
    expect(payload.data.final_decision).toBe('Approve');
    expect(payload.data.decision_source).toBe('manual_override');
  });
});
