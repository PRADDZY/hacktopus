import type { Auth0Client, RedirectLoginOptions } from '@auth0/auth0-spa-js';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AuthRole = 'user' | 'admin';
export type AuthProvider = 'supabase' | 'auth0' | 'none';

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
  auth0Domain: string | undefined;
  auth0ClientId: string | undefined;
  auth0Audience: string | undefined;
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
};

type ProviderProfile = {
  isAuthenticated: boolean;
  user: Record<string, unknown> | null;
};

export type PasskeyFactorStatus = 'verified' | 'unverified';

export type PasskeyFactor = {
  id: string;
  friendlyName: string;
  status: PasskeyFactorStatus;
  createdAt: string | null;
};

export type AuthAssuranceLevel = {
  currentLevel: string | null;
  nextLevel: string | null;
};

type Credentials = {
  email: string;
  password: string;
};

type SignupInput = Credentials & {
  name?: string;
  phone?: string;
  role?: AuthRole;
};

let auth0ClientPromise: Promise<Auth0Client | null> | null = null;
let supabaseClientPromise: Promise<SupabaseClient | null> | null = null;

const authConfig: AuthConfig = {
  auth0Domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN,
  auth0ClientId: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID,
  auth0Audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

const isAuth0Configured = (): boolean =>
  Boolean(authConfig.auth0Domain && authConfig.auth0ClientId && authConfig.auth0Audience);

const isSupabaseConfigured = (): boolean =>
  Boolean(authConfig.supabaseUrl && authConfig.supabaseAnonKey);

export const getAuthProvider = (): AuthProvider => {
  if (isSupabaseConfigured()) {
    return 'supabase';
  }
  if (isAuth0Configured()) {
    return 'auth0';
  }
  return 'none';
};

export const isAuthConfigured = (): boolean => getAuthProvider() !== 'none';

const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3000';
};

const defaultReturnPath = (role: AuthRole): string => (role === 'admin' ? '/dashboard' : '/');

const loadAuth0Sdk = async () => import('@auth0/auth0-spa-js');
const loadSupabaseSdk = async () => import('@supabase/supabase-js');

const createAuth0Client = async (): Promise<Auth0Client | null> => {
  if (!isAuth0Configured() || typeof window === 'undefined') {
    return null;
  }

  const sdk = await loadAuth0Sdk();
  return sdk.createAuth0Client({
    domain: authConfig.auth0Domain!,
    clientId: authConfig.auth0ClientId!,
    cacheLocation: 'localstorage',
    useRefreshTokens: true,
    authorizationParams: {
      audience: authConfig.auth0Audience!,
      redirect_uri: `${getBaseUrl()}/auth/callback`,
      scope: 'openid profile email',
    },
  });
};

const getAuth0Client = async (): Promise<Auth0Client | null> => {
  if (!auth0ClientPromise) {
    auth0ClientPromise = createAuth0Client();
  }
  return auth0ClientPromise;
};

const createSupabaseClient = async (): Promise<SupabaseClient | null> => {
  if (!isSupabaseConfigured() || typeof window === 'undefined') {
    return null;
  }
  const sdk = await loadSupabaseSdk();
  return sdk.createClient(authConfig.supabaseUrl!, authConfig.supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
};

const getSupabaseClient = async (): Promise<SupabaseClient | null> => {
  if (!supabaseClientPromise) {
    supabaseClientPromise = createSupabaseClient();
  }
  return supabaseClientPromise;
};

const hasWebAuthnSupport = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.PublicKeyCredential !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  !!navigator.credentials;

const normalizePasskeyName = (value: string | undefined): string => {
  const trimmed = value?.trim();
  if (trimmed) {
    return trimmed.slice(0, 80);
  }
  const stamp = new Date().toISOString().replace(/[^\d]/g, '').slice(0, 12);
  return `FairLens Passkey ${stamp}`;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

export const isPasskeySupported = (): boolean => getAuthProvider() === 'supabase' && hasWebAuthnSupport();

const getSupabaseClientOrThrow = async (): Promise<SupabaseClient> => {
  const client = await getSupabaseClient();
  if (!client) {
    throw new Error('Supabase auth is not configured');
  }
  return client;
};

type WebAuthnResult = {
  error: { message?: string } | null;
};

type SupabaseWebAuthnApi = {
  register: (params: { friendlyName: string }) => Promise<WebAuthnResult>;
  authenticate: (params: { factorId: string }) => Promise<WebAuthnResult>;
};

const getSupabaseWebAuthnApi = (client: SupabaseClient): SupabaseWebAuthnApi => {
  const auth = client.auth as unknown as { webauthn?: SupabaseWebAuthnApi };
  const api = auth.webauthn;
  if (!api) {
    throw new Error('Supabase WebAuthn API is unavailable in this SDK build');
  }
  return api;
};

export const listPasskeys = async (): Promise<PasskeyFactor[]> => {
  if (getAuthProvider() !== 'supabase') {
    return [];
  }

  const client = await getSupabaseClientOrThrow();
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) {
    throw new Error(error.message);
  }

  const payload = asRecord(data) ?? {};
  const all = Array.isArray(payload.all) ? payload.all : [];
  const webauthn = Array.isArray(payload.webauthn) ? payload.webauthn : [];
  const source = all.length > 0 ? all : webauthn;

  const factors: PasskeyFactor[] = [];
  for (const item of source) {
    const row = asRecord(item);
    if (!row) {
      continue;
    }

    const factorType = asString(row.factor_type) ?? 'webauthn';
    if (factorType.toLowerCase() !== 'webauthn') {
      continue;
    }

    const id = asString(row.id);
    if (!id) {
      continue;
    }

    const statusValue = (asString(row.status) ?? 'unverified').toLowerCase();
    const status: PasskeyFactorStatus = statusValue === 'verified' ? 'verified' : 'unverified';
    const friendlyName = asString(row.friendly_name) ?? `Passkey ${id.slice(0, 8)}`;
    const createdAt = asString(row.created_at);

    factors.push({
      id,
      friendlyName,
      status,
      createdAt,
    });
  }

  return factors;
};

export const registerPasskey = async (friendlyName?: string): Promise<void> => {
  if (getAuthProvider() !== 'supabase') {
    throw new Error('Passkeys are available only with Supabase auth');
  }
  if (!hasWebAuthnSupport()) {
    throw new Error('This browser does not support passkeys');
  }

  const client = await getSupabaseClientOrThrow();
  const webauthn = getSupabaseWebAuthnApi(client);
  const { error } = await webauthn.register({
    friendlyName: normalizePasskeyName(friendlyName),
  });
  if (error) {
    throw new Error(error.message ?? 'Passkey registration failed');
  }
};

export const authenticateWithPasskey = async (factorId: string): Promise<void> => {
  if (getAuthProvider() !== 'supabase') {
    throw new Error('Passkeys are available only with Supabase auth');
  }
  if (!hasWebAuthnSupport()) {
    throw new Error('This browser does not support passkeys');
  }

  const normalizedFactorId = factorId.trim();
  if (!normalizedFactorId) {
    throw new Error('Passkey factor id is required');
  }

  const client = await getSupabaseClientOrThrow();
  const webauthn = getSupabaseWebAuthnApi(client);
  const { error } = await webauthn.authenticate({
    factorId: normalizedFactorId,
  });
  if (error) {
    throw new Error(error.message ?? 'Passkey verification failed');
  }
};

export const removePasskey = async (factorId: string): Promise<void> => {
  if (getAuthProvider() !== 'supabase') {
    throw new Error('Passkeys are available only with Supabase auth');
  }

  const normalizedFactorId = factorId.trim();
  if (!normalizedFactorId) {
    throw new Error('Passkey factor id is required');
  }

  const client = await getSupabaseClientOrThrow();
  const { error } = await client.auth.mfa.unenroll({ factorId: normalizedFactorId });
  if (error) {
    throw new Error(error.message);
  }
};

export const getAuthAssuranceLevel = async (): Promise<AuthAssuranceLevel> => {
  if (getAuthProvider() !== 'supabase') {
    return {
      currentLevel: null,
      nextLevel: null,
    };
  }

  const client = await getSupabaseClientOrThrow();
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) {
    throw new Error(error.message);
  }

  return {
    currentLevel: data.currentLevel,
    nextLevel: data.nextLevel,
  };
};

export const beginAuthFlow = async (options: AuthFlowOptions = {}): Promise<void> => {
  const provider = getAuthProvider();
  if (provider !== 'auth0') {
    return;
  }

  const client = await getAuth0Client();
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

export const loginWithEmailPassword = async ({ email, password }: Credentials): Promise<boolean> => {
  if (typeof window === 'undefined') {
    return false;
  }

  const provider = getAuthProvider();
  if (provider !== 'supabase') {
    return false;
  }

  const client = await getSupabaseClient();
  if (!client) {
    return false;
  }

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(error.message);
  }
  return true;
};

export const signupWithEmailPassword = async ({
  email,
  password,
  name,
  phone,
  role,
}: SignupInput): Promise<boolean> => {
  if (typeof window === 'undefined') {
    return false;
  }

  const provider = getAuthProvider();
  if (provider !== 'supabase') {
    return false;
  }

  const client = await getSupabaseClient();
  if (!client) {
    return false;
  }

  const metadata: Record<string, unknown> = {};
  if (name?.trim()) {
    metadata.name = name.trim();
  }
  if (phone?.trim()) {
    metadata.phone = phone.trim();
  }
  if (role) {
    metadata.requested_role = role;
  }

  const { error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });

  if (error) {
    throw new Error(error.message);
  }
  return true;
};

export const loginWithPhoneOtp = async (phone: string, otp: string): Promise<boolean> => {
  if (typeof window === 'undefined') {
    return false;
  }

  const provider = getAuthProvider();
  if (provider !== 'supabase') {
    return false;
  }

  const normalizedPhone = phone.trim();
  const normalizedOtp = otp.trim();
  if (!normalizedPhone || !normalizedOtp) {
    throw new Error('Phone and OTP are required for phone sign-in');
  }

  const client = await getSupabaseClient();
  if (!client) {
    return false;
  }

  const { error } = await client.auth.verifyOtp({
    phone: normalizedPhone,
    token: normalizedOtp,
    type: 'sms',
  });
  if (error) {
    throw new Error(error.message);
  }
  return true;
};

export const completeAuthCallback = async (): Promise<{ returnTo: string; role: AuthRole }> => {
  const provider = getAuthProvider();
  if (provider === 'auth0') {
    const client = await getAuth0Client();
    if (!client) {
      return { returnTo: '/', role: 'user' };
    }

    const callbackResult = await client.handleRedirectCallback();
    const appState = (callbackResult?.appState ?? {}) as AuthCallbackState;
    const role = appState.role ?? 'user';
    const returnTo = appState.returnTo ?? defaultReturnPath(role);
    return { returnTo, role };
  }

  if (provider === 'supabase') {
    const client = await getSupabaseClient();
    if (client) {
      await client.auth.getSession();
    }
  }
  return { returnTo: '/', role: 'user' };
};

export const logoutFromAuthProvider = async (returnTo?: string): Promise<void> => {
  const provider = getAuthProvider();
  if (provider === 'auth0') {
    const client = await getAuth0Client();
    if (!client) {
      return;
    }

    const target = returnTo ?? getBaseUrl();
    await Promise.resolve(
      client.logout({
        logoutParams: { returnTo: target },
      })
    );
    return;
  }

  if (provider === 'supabase') {
    const client = await getSupabaseClient();
    if (!client) {
      return;
    }
    await client.auth.signOut();
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined') {
    return null;
  }

  const provider = getAuthProvider();
  if (provider === 'auth0') {
    const client = await getAuth0Client();
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
  }

  if (provider === 'supabase') {
    const client = await getSupabaseClient();
    if (!client) {
      return null;
    }

    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  }

  return null;
};

const readSupabaseUser = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const getAuthProfile = async (): Promise<ProviderProfile> => {
  if (typeof window === 'undefined') {
    return { isAuthenticated: false, user: null };
  }

  const provider = getAuthProvider();
  if (provider === 'auth0') {
    const client = await getAuth0Client();
    if (!client) {
      return { isAuthenticated: false, user: null };
    }

    const isAuthenticated = await client.isAuthenticated();
    if (!isAuthenticated) {
      return { isAuthenticated: false, user: null };
    }

    const user = await client.getUser();
    return {
      isAuthenticated,
      user: (user as Record<string, unknown> | null) ?? null,
    };
  }

  if (provider === 'supabase') {
    const client = await getSupabaseClient();
    if (!client) {
      return { isAuthenticated: false, user: null };
    }

    const [{ data: sessionData }, { data: userData }] = await Promise.all([
      client.auth.getSession(),
      client.auth.getUser(),
    ]);
    const session = sessionData.session;
    const supabaseUser = readSupabaseUser(userData.user);

    return {
      isAuthenticated: Boolean(session?.access_token && supabaseUser),
      user: supabaseUser,
    };
  }

  return { isAuthenticated: false, user: null };
};
