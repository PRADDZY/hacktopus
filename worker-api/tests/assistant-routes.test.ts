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
  ...overrides,
});

const signToken = async (roles: string[] = []): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({
    roles,
    email: 'admin@example.com',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject('auth0|user-123')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(new TextEncoder().encode(SHARED_SECRET));
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Assistant routes', () => {
  it('returns rule-based checkout guidance by default', async () => {
    const response = await app.request(
      '/v1/assistant/query',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'statement upload is failing in checkout',
          context: { page: '/checkout' },
        }),
      },
      createEnv()
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: {
        category: string;
        source: string;
        suggested_actions: Array<{ action: string; target?: string }>;
      };
      error: unknown;
    };
    expect(payload.error).toBeNull();
    expect(payload.data.category).toBe('checkout');
    expect(payload.data.source).toBe('rule_based');
    expect(payload.data.suggested_actions[0]?.target).toBe('/checkout');
  });

  it('returns admin-aware auth guidance for admin user', async () => {
    const token = await signToken(['admin']);
    const response = await app.request(
      '/v1/assistant/query',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'admin login is not working',
          context: { page: '/dashboard' },
        }),
      },
      createEnv()
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: {
        category: string;
        suggested_actions: Array<{ action: string; target?: string }>;
      };
      error: unknown;
    };
    expect(payload.error).toBeNull();
    expect(payload.data.category).toBe('auth');
    expect(payload.data.suggested_actions[0]?.target).toBe('/admin/login');
  });

  it('uses remote assistant response when configured', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          reply: 'Remote assistant answer',
          category: 'general',
          suggested_actions: [{ label: 'Open support', action: 'navigate', target: '/support' }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await app.request(
      '/v1/assistant/query',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'what can you do?',
        }),
      },
      createEnv({
        AI_ASSISTANT_ENDPOINT: 'https://assistant.example.com/query',
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: { source: string; reply: string };
      error: unknown;
    };
    expect(payload.error).toBeNull();
    expect(payload.data.source).toBe('remote');
    expect(payload.data.reply).toBe('Remote assistant answer');
  });
});
