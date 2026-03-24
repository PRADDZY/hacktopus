import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Context, MiddlewareHandler } from 'hono';
import { failure } from './http';
import type { AppEnv, AuthUser } from './types';

type AuthSettings = {
  authRequired: boolean;
  issuer: string | null;
  audience: string | null;
  jwksUrl: string | null;
  roleClaim: string;
  adminRoles: string[];
  algorithms: string[];
  sharedSecret: string | null;
};

const DEFAULT_ROLE_CLAIM = 'https://fairlens.ai/roles';
const DEFAULT_ADMIN_ROLES = ['admin'];
const DEFAULT_ALGORITHMS = ['RS256'];

const asNonEmpty = (value: string | undefined): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const parseCsv = (value: string | undefined, fallback: string[]): string[] => {
  const normalized = value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return normalized && normalized.length > 0 ? normalized : fallback;
};

const parseBool = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined) {
    return defaultValue;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const getAuthSettings = (c: Context<AppEnv>): AuthSettings => {
  const issuer = asNonEmpty(c.env.AUTH_ISSUER_BASE_URL);
  const audience = asNonEmpty(c.env.AUTH_AUDIENCE);
  const jwksUrl = asNonEmpty(c.env.AUTH_JWKS_URL) ?? (issuer ? `${issuer.replace(/\/$/, '')}/.well-known/jwks.json` : null);
  const sharedSecret = asNonEmpty(c.env.AUTH_SHARED_SECRET);
  const defaultRequired = Boolean(issuer && audience);
  const authRequired = parseBool(c.env.AUTH_REQUIRED, defaultRequired);

  return {
    authRequired,
    issuer,
    audience,
    jwksUrl,
    roleClaim: asNonEmpty(c.env.AUTH_ROLE_CLAIM) ?? DEFAULT_ROLE_CLAIM,
    adminRoles: parseCsv(c.env.AUTH_ADMIN_ROLES, DEFAULT_ADMIN_ROLES),
    algorithms: parseCsv(c.env.AUTH_JWT_ALGORITHMS, DEFAULT_ALGORITHMS),
    sharedSecret
  };
};

const unauthorized = (c: Context<AppEnv>, message: string): Response => {
  const response = failure(c, { code: 'unauthorized', message }, 401);
  response.headers.set('WWW-Authenticate', 'Bearer');
  return response;
};

const forbidden = (c: Context<AppEnv>, message: string): Response =>
  failure(c, { code: 'forbidden', message }, 403);

const serverError = (c: Context<AppEnv>, message: string): Response =>
  failure(c, { code: 'config_error', message }, 500);

const anonymousUser = (): AuthUser => ({
  isAuthenticated: false,
  subject: null,
  email: null,
  roles: [],
  claims: {}
});

const normalizeRoles = (payload: JWTPayload, roleClaim: string): string[] => {
  const sources: unknown[] = [payload[roleClaim], payload.roles, payload.permissions];
  const appMetadata = payload.app_metadata;
  if (typeof appMetadata === 'object' && appMetadata !== null) {
    const appRoles = (appMetadata as Record<string, unknown>).roles;
    sources.push(appRoles);
  }

  const roles: string[] = [];
  for (const source of sources) {
    if (typeof source === 'string') {
      const role = source.trim();
      if (role && !roles.includes(role)) {
        roles.push(role);
      }
      continue;
    }
    if (Array.isArray(source)) {
      for (const item of source) {
        const role = String(item).trim();
        if (role && !roles.includes(role)) {
          roles.push(role);
        }
      }
    }
  }
  return roles;
};

const decodeToken = async (token: string, settings: AuthSettings): Promise<JWTPayload> => {
  const issuer = settings.issuer ?? undefined;
  const audience = settings.audience ?? undefined;

  if (settings.sharedSecret) {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(settings.sharedSecret), {
      issuer,
      audience,
      algorithms: settings.algorithms
    });
    return payload;
  }

  if (!settings.jwksUrl) {
    throw new Error('Missing AUTH_JWKS_URL');
  }

  const jwks = createRemoteJWKSet(new URL(settings.jwksUrl));
  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience,
    algorithms: settings.algorithms
  });
  return payload;
};

const resolveUserFromAuthHeader = async (
  c: Context<AppEnv>,
  settings: AuthSettings
): Promise<AuthUser | null | Response> => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return unauthorized(c, 'Invalid authorization header');
  }

  try {
    const payload = await decodeToken(token, settings);
    const subject = typeof payload.sub === 'string' ? payload.sub.trim() : '';
    if (!subject) {
      return unauthorized(c, 'Access token missing subject');
    }

    const email = typeof payload.email === 'string' && payload.email.trim() ? payload.email.trim() : null;
    return {
      isAuthenticated: true,
      subject,
      email,
      roles: normalizeRoles(payload, settings.roleClaim),
      claims: payload as Record<string, unknown>
    };
  } catch {
    return unauthorized(c, 'Invalid access token');
  }
};

const hasConfig = (settings: AuthSettings): boolean => Boolean(settings.issuer && settings.audience);

export const optionalAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const settings = getAuthSettings(c);

  const resolved = await resolveUserFromAuthHeader(c, settings);
  if (resolved instanceof Response) {
    return resolved;
  }

  c.set('authUser', resolved ?? anonymousUser());
  return await next();
};

export const requireUserAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const settings = getAuthSettings(c);

  if (settings.authRequired && !hasConfig(settings)) {
    return serverError(c, 'Auth is required but AUTH_ISSUER_BASE_URL or AUTH_AUDIENCE is missing');
  }

  const resolved = await resolveUserFromAuthHeader(c, settings);
  if (resolved instanceof Response) {
    return resolved;
  }

  if (!resolved) {
    if (settings.authRequired) {
      return unauthorized(c, 'Missing bearer token');
    }
    c.set('authUser', anonymousUser());
    return await next();
  }

  c.set('authUser', resolved);
  return await next();
};

export const requireAdminAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const userResponse = await requireUserAuth(c, async () => undefined);
  if (userResponse instanceof Response) {
    return userResponse;
  }

  const settings = getAuthSettings(c);
  if (!settings.authRequired) {
    return await next();
  }

  const user = c.get('authUser');
  const normalizedAdminRoles = settings.adminRoles.map((role) => role.toLowerCase());
  const isAdmin = user.roles.some((role) => normalizedAdminRoles.includes(role.toLowerCase()));

  if (!isAdmin) {
    return forbidden(c, 'Admin role required');
  }

  return await next();
};
