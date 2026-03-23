import { SignJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
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

  it('creates document and extraction job for authenticated user', async () => {
    const token = await signToken(['user']);

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = (init?.method || 'GET').toUpperCase();

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

      return jsonResponse({ message: `Unexpected request ${method} ${url.pathname}` }, 500);
    });
    vi.stubGlobal('fetch', fetchMock);

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

      return jsonResponse({ message: `Unexpected request ${method} ${url.pathname}` }, 500);
    });
    vi.stubGlobal('fetch', fetchMock);

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

    expect(response.status).toBe(201);
    const payload = (await response.json()) as {
      error: unknown;
      data: { id: string; final_decision: string };
    };
    expect(payload.error).toBeNull();
    expect(payload.data.id).toBe('asm-1');
    expect(payload.data.final_decision).toBe('Decline');
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
