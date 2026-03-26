import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import type { AppEnv } from '../src/types';

const ISSUER = 'https://auth.example.com/';
const AUDIENCE = 'fairlens-api';
const SHARED_SECRET = 'unit-test-secret';
const SUPABASE_URL = 'https://supabase.example.co';
const SUPABASE_ISSUER = `${SUPABASE_URL}/auth/v1`;
const SUPABASE_JWT_SECRET = 'supabase-jwt-secret';

const createEnv = (overrides: Partial<AppEnv['Bindings']> = {}): AppEnv['Bindings'] => ({
  AUTH_REQUIRED: 'true',
  AUTH_ISSUER_BASE_URL: ISSUER,
  AUTH_AUDIENCE: AUDIENCE,
  AUTH_SHARED_SECRET: SHARED_SECRET,
  AUTH_JWT_ALGORITHMS: 'HS256',
  AUTH_ROLE_CLAIM: 'roles',
  AUTH_ADMIN_ROLES: 'admin',
  ...overrides
});

const signToken = async (roles: string[] = []): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({
    roles,
    email: 'tester@example.com'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject('auth0|user-123')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(new TextEncoder().encode(SHARED_SECRET));
};

const signSupabaseToken = async (
  subject = '22ca95e5-24a6-4f34-a4f4-6df65d0867d6'
): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({
    email: 'supabase-user@example.com',
    role: 'authenticated'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(SUPABASE_ISSUER)
    .setAudience('authenticated')
    .setSubject(subject)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(new TextEncoder().encode(SUPABASE_JWT_SECRET));
};

type ApiEnvelope<T> = {
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
  meta: {
    requestId: string;
    timestamp: string;
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Cloudflare Worker auth middleware', () => {
  it('returns health status without auth', async () => {
    const res = await app.request('/health', undefined, createEnv());
    expect(res.status).toBe(200);
    const payload = (await res.json()) as ApiEnvelope<{ status: string; runtime: string }>;
    expect(payload.error).toBeNull();
    expect(payload.data).toEqual({ status: 'ok', runtime: 'cloudflare-worker' });
    expect(payload.meta.requestId).toBeTruthy();
    expect(payload.meta.timestamp).toBeTruthy();
    expect(res.headers.get('X-Request-Id')).toBe(payload.meta.requestId);
  });

  it('propagates request id when X-Request-Id is provided', async () => {
    const res = await app.request(
      '/health',
      {
        headers: {
          'X-Request-Id': 'req-fixed-123'
        }
      },
      createEnv()
    );

    expect(res.status).toBe(200);
    const payload = (await res.json()) as ApiEnvelope<{ status: string; runtime: string }>;
    expect(payload.meta.requestId).toBe('req-fixed-123');
    expect(res.headers.get('X-Request-Id')).toBe('req-fixed-123');
  });

  it('returns anonymous auth context without bearer token', async () => {
    const res = await app.request('/auth/me', undefined, createEnv());
    expect(res.status).toBe(200);
    const payload = (await res.json()) as ApiEnvelope<{
      is_authenticated: boolean;
      subject: string | null;
      email: string | null;
      roles: string[];
    }>;
    expect(payload.error).toBeNull();
    expect(payload.data).toEqual({
      is_authenticated: false,
      subject: null,
      email: null,
      roles: []
    });
  });

  it('blocks protected user route when auth is required and no token is present', async () => {
    const res = await app.request('/v1/protected/user', undefined, createEnv());
    expect(res.status).toBe(401);
    const payload = (await res.json()) as ApiEnvelope<null>;
    expect(payload.data).toBeNull();
    expect(payload.error).toEqual({
      code: 'unauthorized',
      message: 'Missing bearer token'
    });
  });

  it('allows authenticated user route with valid token', async () => {
    const token = await signToken(['user']);
    const res = await app.request(
      '/v1/protected/user',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      createEnv()
    );
    expect(res.status).toBe(200);
    const payload = (await res.json()) as ApiEnvelope<{ ok: boolean; role: string }>;
    expect(payload.error).toBeNull();
    expect(payload.data).toEqual({ ok: true, role: 'user' });
  });

  it('blocks admin route for non-admin role', async () => {
    const token = await signToken(['user']);
    const res = await app.request(
      '/v1/protected/admin',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      createEnv()
    );
    expect(res.status).toBe(403);
    const payload = (await res.json()) as ApiEnvelope<null>;
    expect(payload.data).toBeNull();
    expect(payload.error).toEqual({
      code: 'forbidden',
      message: 'Admin role required'
    });
  });

  it('allows admin route for admin role', async () => {
    const token = await signToken(['admin']);
    const res = await app.request(
      '/v1/protected/admin',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      createEnv()
    );
    expect(res.status).toBe(200);
    const payload = (await res.json()) as ApiEnvelope<{ ok: boolean; role: string }>;
    expect(payload.error).toBeNull();
    expect(payload.data).toEqual({ ok: true, role: 'admin' });
  });

  it('allows supabase token and resolves admin role from user_roles table', async () => {
    const token = await signSupabaseToken();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.pathname).toContain('/rest/v1/user_roles');
      expect(url.searchParams.get('user_id')).toBe('eq.22ca95e5-24a6-4f34-a4f4-6df65d0867d6');
      return new Response(JSON.stringify([{ role: 'admin' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await app.request(
      '/v1/protected/admin',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      createEnv({
        AUTH_ISSUER_BASE_URL: undefined,
        AUTH_AUDIENCE: undefined,
        AUTH_SHARED_SECRET: undefined,
        AUTH_JWKS_URL: undefined,
        AUTH_JWT_ALGORITHMS: undefined,
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        SUPABASE_JWT_SECRET
      })
    );

    expect(res.status).toBe(200);
    const payload = (await res.json()) as ApiEnvelope<{ ok: boolean; role: string }>;
    expect(payload.error).toBeNull();
    expect(payload.data).toEqual({ ok: true, role: 'admin' });
  });

  it('allows ES256 supabase token via JWKS and resolves admin role', async () => {
    const { publicKey, privateKey } = await generateKeyPair('ES256');
    const publicJwk = await exportJWK(publicKey);
    const kid = 'test-supabase-kid';
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({
      email: 'supabase-user@example.com',
      role: 'authenticated'
    })
      .setProtectedHeader({ alg: 'ES256', kid })
      .setIssuer(SUPABASE_ISSUER)
      .setAudience('authenticated')
      .setSubject('22ca95e5-24a6-4f34-a4f4-6df65d0867d6')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(privateKey);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        input instanceof URL
          ? input
          : typeof input === 'string'
            ? new URL(input)
            : new URL(input.url);

      if (url.pathname.endsWith('/auth/v1/.well-known/jwks.json')) {
        return new Response(JSON.stringify({ keys: [{ ...publicJwk, kid, use: 'sig', alg: 'ES256' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url.pathname.includes('/rest/v1/user_roles')) {
        return new Response(JSON.stringify([{ role: 'admin' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await app.request(
      '/v1/protected/admin',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      createEnv({
        AUTH_ISSUER_BASE_URL: undefined,
        AUTH_AUDIENCE: undefined,
        AUTH_SHARED_SECRET: undefined,
        AUTH_JWKS_URL: undefined,
        AUTH_JWT_ALGORITHMS: undefined,
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        SUPABASE_JWT_SECRET: undefined
      })
    );

    expect(res.status).toBe(200);
    const payload = (await res.json()) as ApiEnvelope<{ ok: boolean; role: string }>;
    expect(payload.error).toBeNull();
    expect(payload.data).toEqual({ ok: true, role: 'admin' });
  });

  it('handles CORS preflight for assessment route', async () => {
    const origin = 'https://fairlens-frontend.dpratik3005.workers.dev';
    const res = await app.request(
      '/v1/assessments',
      {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization,content-type,idempotency-key'
        }
      },
      createEnv({
        CORS_ALLOWED_ORIGINS: origin
      })
    );

    expect([200, 204]).toContain(res.status);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });
});
