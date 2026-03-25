import { Hono } from 'hono';
import { optionalAuth, requireAdminAuth, requireUserAuth } from './auth';
import { requestContextMiddleware, success } from './http';
import assistantRoutes from './routes/assistant';
import domainRoutes from './routes/domain';
import type { AppEnv } from './types';

export const app = new Hono<AppEnv>();

app.use('*', requestContextMiddleware);

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
