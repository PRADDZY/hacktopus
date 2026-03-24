import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
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
});
