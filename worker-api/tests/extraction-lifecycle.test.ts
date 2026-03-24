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
  MODAL_EXTRACTION_ENDPOINT: 'https://modal.example.run/extract',
  EXTRACTION_CALLBACK_SECRET: 'callback-secret',
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

describe('Worker extraction lifecycle', () => {
  it('dispatches extraction job to Modal when endpoint is configured', async () => {
    const token = await signToken(['user']);

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = (init?.method || 'GET').toUpperCase();

      if (url.pathname.endsWith('/api_idempotency_keys') && method === 'POST') {
        return jsonResponse([
          {
            id: 'idem-extract-doc-10',
            owner_sub: 'auth0|user-123',
            route_key: 'post:/v1/documents',
            idempotency_key: 'idem-extract-doc-10',
            request_hash: 'hash-doc-10',
            state: 'in_progress'
          }
        ]);
      }

      if (url.pathname.endsWith('/documents') && method === 'POST') {
        return jsonResponse([
          { id: 'doc-10', owner_sub: 'auth0|user-123', storage_key: 'uploads/10.pdf', status: 'queued' }
        ]);
      }
      if (url.pathname.endsWith('/extraction_jobs') && method === 'POST') {
        return jsonResponse([{ id: 'job-10', document_id: 'doc-10', status: 'queued' }]);
      }
      if (url.pathname.endsWith('/documents') && method === 'PATCH') {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        if (body.extraction_job_id) {
          return jsonResponse([
            { id: 'doc-10', owner_sub: 'auth0|user-123', extraction_job_id: 'job-10', status: 'queued' }
          ]);
        }
        if (body.status === 'processing') {
          return jsonResponse([
            { id: 'doc-10', owner_sub: 'auth0|user-123', extraction_job_id: 'job-10', status: 'processing' }
          ]);
        }
      }
      if (url.hostname === 'modal.example.run' && method === 'POST') {
        return jsonResponse({ job_id: 'modal-job-10' });
      }
      if (url.pathname.endsWith('/extraction_jobs') && method === 'PATCH') {
        return jsonResponse([
          { id: 'job-10', document_id: 'doc-10', status: 'processing', external_job_id: 'modal-job-10' }
        ]);
      }
      if (url.pathname.endsWith('/api_idempotency_keys') && method === 'PATCH') {
        return jsonResponse([
          {
            id: 'idem-extract-doc-10',
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
          'Idempotency-Key': 'idem-extract-doc-10',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          storage_key: 'uploads/10.pdf',
          file_name: '10.pdf',
          mime_type: 'application/pdf'
        })
      },
      createEnv()
    );

    expect(response.status).toBe(201);
    const payload = (await response.json()) as {
      data: { extraction_job_status?: string; external_job_id?: string };
      error: unknown;
    };
    expect(payload.error).toBeNull();
    expect(payload.data.extraction_job_status).toBe('processing');
    expect(payload.data.external_job_id).toBe('modal-job-10');
  });

  it('rejects extraction callback when secret header is missing', async () => {
    const response = await app.request(
      '/v1/extraction-jobs/job-11/callback',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', features: { stress_index: 0.2 } })
      },
      createEnv()
    );
    expect(response.status).toBe(401);
  });

  it('accepts completed callback and updates job/document/features', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = (init?.method || 'GET').toUpperCase();

      if (url.pathname.endsWith('/extraction_jobs') && method === 'GET') {
        return jsonResponse([{ id: 'job-12', document_id: 'doc-12', status: 'processing' }]);
      }
      if (url.pathname.endsWith('/documents') && method === 'GET') {
        return jsonResponse([{ id: 'doc-12', owner_sub: 'auth0|user-12', status: 'processing' }]);
      }
      if (url.pathname.endsWith('/extracted_features') && method === 'GET') {
        return jsonResponse([]);
      }
      if (url.pathname.endsWith('/extracted_features') && method === 'POST') {
        return jsonResponse([
          {
            id: 'feat-12',
            document_id: 'doc-12',
            owner_sub: 'auth0|user-12',
            payload: { stress_index: 0.3 }
          }
        ]);
      }
      if (url.pathname.endsWith('/extraction_jobs') && method === 'PATCH') {
        return jsonResponse([{ id: 'job-12', document_id: 'doc-12', status: 'completed' }]);
      }
      if (url.pathname.endsWith('/documents') && method === 'PATCH') {
        return jsonResponse([{ id: 'doc-12', owner_sub: 'auth0|user-12', status: 'ready' }]);
      }

      return jsonResponse({ message: `Unexpected request ${method} ${url.pathname}` }, 500);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await app.request(
      '/v1/extraction-jobs/job-12/callback',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Callback-Secret': 'callback-secret'
        },
        body: JSON.stringify({
          status: 'completed',
          external_job_id: 'modal-job-12',
          features: { stress_index: 0.3, total_burden_ratio: 0.4 }
        })
      },
      createEnv()
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: { status: string; document_status: string } };
    expect(payload.data.status).toBe('completed');
    expect(payload.data.document_status).toBe('ready');
  });

  it('allows owner to fetch extraction job status and blocks other users', async () => {
    const ownerToken = await signToken(['user'], 'auth0|owner-1');
    const strangerToken = await signToken(['user'], 'auth0|stranger-1');

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = (init?.method || 'GET').toUpperCase();
      if (url.pathname.endsWith('/extraction_jobs') && method === 'GET') {
        return jsonResponse([
          {
            id: 'job-13',
            document_id: 'doc-13',
            status: 'processing',
            external_job_id: 'modal-job-13'
          }
        ]);
      }
      if (url.pathname.endsWith('/documents') && method === 'GET') {
        return jsonResponse([{ id: 'doc-13', owner_sub: 'auth0|owner-1', status: 'processing' }]);
      }
      return jsonResponse({ message: `Unexpected request ${method} ${url.pathname}` }, 500);
    });
    vi.stubGlobal('fetch', fetchMock);

    const ownerResponse = await app.request(
      '/v1/extraction-jobs/job-13',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      createEnv()
    );
    expect(ownerResponse.status).toBe(200);

    const strangerResponse = await app.request(
      '/v1/extraction-jobs/job-13',
      { headers: { Authorization: `Bearer ${strangerToken}` } },
      createEnv()
    );
    expect(strangerResponse.status).toBe(403);
  });
});
