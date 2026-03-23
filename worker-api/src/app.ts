import { Hono } from 'hono';
import { optionalAuth, requireAdminAuth, requireUserAuth } from './auth';
import domainRoutes from './routes/domain';
import type { AppEnv } from './types';

export const app = new Hono<AppEnv>();

app.get('/health', (c) => c.json({ status: 'ok', runtime: 'cloudflare-worker' }));

app.get('/auth/me', optionalAuth, (c) => {
  const user = c.get('authUser');
  return c.json({
    is_authenticated: user.isAuthenticated,
    subject: user.subject,
    email: user.email,
    roles: user.roles
  });
});

app.get('/v1/protected/user', requireUserAuth, (c) =>
  c.json({
    ok: true,
    role: 'user'
  })
);

app.get('/v1/protected/admin', requireAdminAuth, (c) =>
  c.json({
    ok: true,
    role: 'admin'
  })
);

app.route('/v1', domainRoutes);
