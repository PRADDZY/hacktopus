import type { Auth0Client, RedirectLoginOptions, User } from '@auth0/auth0-spa-js';

export type AuthRole = 'user' | 'admin';

type AuthFlowMode = 'login' | 'signup';

type AuthCallbackState = {
  returnTo?: string;
  role?: AuthRole;
};

type AuthFlowOptions = {
  mode?: AuthFlowMode;
  role?: AuthRole;
  returnTo?: string;
};

type AuthConfig = {
  domain: string | undefined;
  clientId: string | undefined;
  audience: string | undefined;
};

let auth0ClientPromise: Promise<Auth0Client | null> | null = null;

const authConfig: AuthConfig = {
  domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN,
  clientId: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID,
  audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
};

const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3000';
};

const defaultReturnPath = (role: AuthRole): string => {
  if (role === 'admin') {
    return '/dashboard';
  }
  return '/';
};

const loadAuth0Sdk = async () => import('@auth0/auth0-spa-js');

export const isAuthConfigured = (): boolean =>
  Boolean(authConfig.domain && authConfig.clientId && authConfig.audience);

const createClient = async (): Promise<Auth0Client | null> => {
  if (!isAuthConfigured() || typeof window === 'undefined') {
    return null;
  }

  const sdk = await loadAuth0Sdk();
  return sdk.createAuth0Client({
    domain: authConfig.domain!,
    clientId: authConfig.clientId!,
    cacheLocation: 'localstorage',
    useRefreshTokens: true,
    authorizationParams: {
      audience: authConfig.audience!,
      redirect_uri: `${getBaseUrl()}/auth/callback`,
      scope: 'openid profile email',
    },
  });
};

const getClient = async (): Promise<Auth0Client | null> => {
  if (!auth0ClientPromise) {
    auth0ClientPromise = createClient();
  }
  return auth0ClientPromise;
};

export const beginAuthFlow = async (options: AuthFlowOptions = {}): Promise<void> => {
  const client = await getClient();
  if (!client) {
    return;
  }

  const role = options.role ?? 'user';
  const returnTo = options.returnTo ?? defaultReturnPath(role);
  const mode = options.mode ?? 'login';

  const authorizationParams: RedirectLoginOptions['authorizationParams'] = {};
  if (mode === 'signup') {
    authorizationParams.screen_hint = 'signup';
  }

  await client.loginWithRedirect({
    authorizationParams,
    appState: { returnTo, role } satisfies AuthCallbackState,
  });
};

export const completeAuthCallback = async (): Promise<{ returnTo: string; role: AuthRole }> => {
  const client = await getClient();
  if (!client) {
    return { returnTo: '/', role: 'user' };
  }

  const callbackResult = await client.handleRedirectCallback();
  const appState = (callbackResult?.appState ?? {}) as AuthCallbackState;
  const role = appState.role ?? 'user';
  const returnTo = appState.returnTo ?? defaultReturnPath(role);
  return { returnTo, role };
};

export const logoutFromAuthProvider = async (returnTo?: string): Promise<void> => {
  const client = await getClient();
  if (!client) {
    return;
  }

  const target = returnTo ?? getBaseUrl();
  await Promise.resolve(
    client.logout({
      logoutParams: { returnTo: target },
    })
  );
};

export const getAccessToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined') {
    return null;
  }

  const client = await getClient();
  if (!client) {
    return null;
  }

  const authenticated = await client.isAuthenticated();
  if (!authenticated) {
    return null;
  }

  try {
    return await client.getTokenSilently();
  } catch {
    return null;
  }
};

export const getAuthProfile = async (): Promise<{ isAuthenticated: boolean; user: User | null }> => {
  if (typeof window === 'undefined') {
    return { isAuthenticated: false, user: null };
  }

  const client = await getClient();
  if (!client) {
    return { isAuthenticated: false, user: null };
  }

  const isAuthenticated = await client.isAuthenticated();
  if (!isAuthenticated) {
    return { isAuthenticated: false, user: null };
  }

  const user = await client.getUser();
  return { isAuthenticated, user: user ?? null };
};
