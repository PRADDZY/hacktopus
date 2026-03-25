import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Context, MiddlewareHandler } from 'hono';
import { failure } from './http';
import type { AppEnv, AuthUser } from './types';

type AuthSettings = {
  authRequired: boolean;
  issuer: string | null;
  audience: string | null;
  jwksUrl: string | null;
  mode: 'supabase' | 'auth0';
  roleClaim: string;
  adminRoles: string[];
  algorithms: string[];
  sharedSecret: string | null;
  supabaseUrl: string | null;
  supabaseServiceRoleKey: string | null;
};

const DEFAULT_ROLE_CLAIM = 'https://fairlens.ai/roles';
const DEFAULT_ADMIN_ROLES = ['admin'];
const DEFAULT_ALGORITHMS = ['RS256'];
const DEFAULT_SUPABASE_ALGORITHMS = ['HS256'];

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
  const supabaseUrl = asNonEmpty(c.env.SUPABASE_URL);
  const supabaseServiceRoleKey = asNonEmpty(c.env.SUPABASE_SERVICE_ROLE_KEY);
  const supabaseJwtSecret = asNonEmpty(c.env.SUPABASE_JWT_SECRET);
  const auth0Issuer = asNonEmpty(c.env.AUTH_ISSUER_BASE_URL);
  const auth0Audience = asNonEmpty(c.env.AUTH_AUDIENCE);
  const auth0JwksUrl =
    asNonEmpty(c.env.AUTH_JWKS_URL) ??
    (auth0Issuer ? `${auth0Issuer.replace(/\/$/, '')}/.well-known/jwks.json` : null);
  const auth0SharedSecret = asNonEmpty(c.env.AUTH_SHARED_SECRET);
  const supabaseIssuer =
    asNonEmpty(c.env.SUPABASE_AUTH_ISSUER) ??
    (supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/auth/v1` : null);
  const supabaseAudience = asNonEmpty(c.env.AUTH_AUDIENCE) ?? 'authenticated';
  const useSupabaseMode = Boolean(supabaseJwtSecret && supabaseIssuer);

  const issuer = useSupabaseMode ? supabaseIssuer : auth0Issuer;
  const audience = useSupabaseMode ? supabaseAudience : auth0Audience;
  const jwksUrl = useSupabaseMode ? null : auth0JwksUrl;
  const sharedSecret = useSupabaseMode ? supabaseJwtSecret : auth0SharedSecret;
  const defaultRequired = Boolean(issuer && audience);
  const authRequired = parseBool(c.env.AUTH_REQUIRED, defaultRequired);

  return {
    authRequired,
    issuer,
    audience,
    jwksUrl,
    mode: useSupabaseMode ? 'supabase' : 'auth0',
    roleClaim: asNonEmpty(c.env.AUTH_ROLE_CLAIM) ?? DEFAULT_ROLE_CLAIM,
    adminRoles: parseCsv(c.env.AUTH_ADMIN_ROLES, DEFAULT_ADMIN_ROLES),
    algorithms: parseCsv(
      c.env.AUTH_JWT_ALGORITHMS,
      useSupabaseMode ? DEFAULT_SUPABASE_ALGORITHMS : DEFAULT_ALGORITHMS
    ),
    sharedSecret,
    supabaseUrl,
    supabaseServiceRoleKey
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

const normalizeRolesFromClaims = (payload: JWTPayload, roleClaim: string): string[] => {
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

const appendRole = (roles: string[], role: string | null): void => {
  const normalized = role?.trim();
  if (!normalized) {
    return;
  }
  if (!roles.includes(normalized)) {
    roles.push(normalized);
  }
};

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());

const resolveRoleFromSupabase = async (
  settings: AuthSettings,
  subject: string
): Promise<string | null> => {
  if (
    settings.mode !== 'supabase' ||
    !settings.supabaseUrl ||
    !settings.supabaseServiceRoleKey ||
    !isUuid(subject)
  ) {
    return null;
  }

  const url = new URL(`${settings.supabaseUrl.replace(/\/$/, '')}/rest/v1/user_roles`);
  url.searchParams.set('select', 'role');
  url.searchParams.set('user_id', `eq.${subject}`);
  url.searchParams.set('limit', '1');

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        apikey: settings.supabaseServiceRoleKey,
        Authorization: `Bearer ${settings.supabaseServiceRoleKey}`,
        Accept: 'application/json',
        'Accept-Profile': 'public'
      }
    });
    if (!response.ok) {
      return null;
    }

    const rows = (await response.json().catch(() => null)) as Array<{ role?: unknown }> | null;
    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }

    const role = rows[0]?.role;
    return typeof role === 'string' ? role.trim() || null : null;
  } catch {
    return null;
  }
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
    const roles = normalizeRolesFromClaims(payload, settings.roleClaim);
    const roleFromSupabase = await resolveRoleFromSupabase(settings, subject);
    appendRole(roles, roleFromSupabase);

    return {
      isAuthenticated: true,
      subject,
      email,
      roles,
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
    return serverError(c, 'Auth is required but issuer/audience configuration is incomplete');
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
