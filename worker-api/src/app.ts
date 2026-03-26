import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { optionalAuth, requireAdminAuth, requireUserAuth } from './auth';
import { requestContextMiddleware, success } from './http';
import assistantRoutes from './routes/assistant';
import domainRoutes from './routes/domain';
import type { AppEnv } from './types';

export const app = new Hono<AppEnv>();

const parseAllowedOrigins = (value: string | undefined): string[] => {
  const normalized = value
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return normalized && normalized.length > 0 ? normalized : ['*'];
};

app.use('*', requestContextMiddleware);
app.use('*', async (c, next) => {
  const allowedOrigins = parseAllowedOrigins(c.env.CORS_ALLOWED_ORIGINS);
  const middleware = cors({
    origin: (origin) => {
      const wildcard = allowedOrigins.includes('*');
      if (wildcard) {
        return '*';
      }
      if (!origin) {
        return allowedOrigins[0] ?? '*';
      }
      return allowedOrigins.includes(origin) ? origin : '';
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: [
      'Authorization',
      'Content-Type',
      'Idempotency-Key',
      'X-Request-Id'
    ],
    exposeHeaders: ['X-Request-Id'],
    maxAge: 86400
  });
  return middleware(c, next);
});

app.get('/health', (c) =>
  success(c, {
    status: 'ok',
    runtime: 'cloudflare-worker'
  })
);

app.get('/auth/me', optionalAuth, (c) => {
  const user = c.get('authUser');
  return success(c, {
    is_authenticated: user.isAuthenticated,
    subject: user.subject,
    email: user.email,
    roles: user.roles
  });
});

app.get('/v1/protected/user', requireUserAuth, (c) =>
  success(c, {
    ok: true,
    role: 'user'
  })
);

app.get('/v1/protected/admin', requireAdminAuth, (c) =>
  success(c, {
    ok: true,
    role: 'admin'
  })
);

app.route('/v1', domainRoutes);
app.route('/v1/assistant', assistantRoutes);
