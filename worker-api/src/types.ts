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
  CORS_ALLOWED_ORIGINS?: string;
  AUTH_SHARED_SECRET?: string;
  SUPABASE_JWT_SECRET?: string;
  SUPABASE_AUTH_ISSUER?: string;
  SUPABASE_JWKS_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_REST_SCHEMA?: string;
  RISK_APPROVAL_THRESHOLD?: string;
  MODEL_VERSION?: string;
  MODEL_SCORING_ENDPOINT?: string;
  MODEL_SCORING_TOKEN?: string;
  WORKER_SCORING_FALLBACK_ENABLED?: string;
  FEATURE_EXTRACTION_ENDPOINT?: string;
  FEATURE_EXTRACTION_TOKEN?: string;
  MODAL_EXTRACTION_ENDPOINT?: string;
  MODAL_EXTRACTION_TOKEN?: string;
  EXTRACTION_CALLBACK_SECRET?: string;
  AI_ASSISTANT_ENDPOINT?: string;
  AI_ASSISTANT_TOKEN?: string;
  IDEMPOTENCY_TTL_SECONDS?: string;
};

export type AppVariables = {
  authUser: AuthUser;
  requestId: string;
};

export type AppEnv = {
  Bindings: AppBindings;
  Variables: AppVariables;
};
