export type AuthUser = {
  isAuthenticated: boolean;
  subject: string | null;
  email: string | null;
  roles: string[];
  claims: Record<string, unknown>;
};

export type AppBindings = {
  AUTH_REQUIRED?: string;
  AUTH_ISSUER_BASE_URL?: string;
  AUTH_AUDIENCE?: string;
  AUTH_JWKS_URL?: string;
  AUTH_ROLE_CLAIM?: string;
  AUTH_ADMIN_ROLES?: string;
  AUTH_JWT_ALGORITHMS?: string;
  AUTH_SHARED_SECRET?: string;
};

export type AppVariables = {
  authUser: AuthUser;
};

export type AppEnv = {
  Bindings: AppBindings;
  Variables: AppVariables;
};
