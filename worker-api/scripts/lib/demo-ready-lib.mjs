import process from 'node:process';

const asNonEmpty = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const parseBooleanEnv = (value, defaultValue) => {
  const normalized = asNonEmpty(value);
  if (!normalized) {
    return defaultValue;
  }
  const lower = normalized.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(lower)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(lower)) {
    return false;
  }
  return defaultValue;
};

const normalizeBaseUrl = (value, fieldName) => {
  const normalized = asNonEmpty(value);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error(`${fieldName} must be a valid absolute URL`);
  }
};

const validateEmail = (value, fieldName) => {
  const normalized = asNonEmpty(value);
  if (!normalized || !normalized.includes('@')) {
    throw new Error(`${fieldName} must be a valid email address`);
  }
  return normalized.toLowerCase();
};

const validatePassword = (value, fieldName) => {
  const normalized = asNonEmpty(value);
  if (!normalized || normalized.length < 8) {
    throw new Error(`${fieldName} must be at least 8 characters`);
  }
  return normalized;
};

export const mergeArgFlags = (argv = process.argv.slice(2)) => new Set(argv);

export const collectDemoReadyConfig = (env = process.env, argFlags = mergeArgFlags()) => {
  const requiredFields = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
    'DEMO_ADMIN_EMAIL',
    'DEMO_ADMIN_PASSWORD',
    'DEMO_USER_EMAIL',
    'DEMO_USER_PASSWORD',
    'SMOKE_BASE_URL',
  ];

  const missing = requiredFields.filter((field) => !asNonEmpty(env[field]));
  if (missing.length > 0) {
    throw new Error(`Missing required environment: ${missing.join(', ')}`);
  }

  const shouldResetFromEnv = parseBooleanEnv(env.DEMO_RESET, true);
  const shouldReset = argFlags.has('--no-reset') ? false : shouldResetFromEnv;
  const dryRun = argFlags.has('--dry-run');

  return {
    supabaseUrl: normalizeBaseUrl(env.SUPABASE_URL, 'SUPABASE_URL'),
    serviceRoleKey: asNonEmpty(env.SUPABASE_SERVICE_ROLE_KEY),
    anonKey: asNonEmpty(env.SUPABASE_ANON_KEY),
    smokeBaseUrl: normalizeBaseUrl(env.SMOKE_BASE_URL, 'SMOKE_BASE_URL'),
    shouldReset,
    dryRun,
    admin: {
      email: validateEmail(env.DEMO_ADMIN_EMAIL, 'DEMO_ADMIN_EMAIL'),
      password: validatePassword(env.DEMO_ADMIN_PASSWORD, 'DEMO_ADMIN_PASSWORD'),
      role: 'admin',
      label: 'admin',
    },
    user: {
      email: validateEmail(env.DEMO_USER_EMAIL, 'DEMO_USER_EMAIL'),
      password: validatePassword(env.DEMO_USER_PASSWORD, 'DEMO_USER_PASSWORD'),
      role: 'user',
      label: 'user',
    },
  };
};

export const extractAccessToken = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const token = payload.access_token;
  if (typeof token !== 'string') {
    return null;
  }

  const normalized = token.trim();
  return normalized || null;
};

export const buildAssessmentFeaturePayload = ({
  purchaseAmount,
  tenureWeeks,
  segment = 'gig_worker',
  monthlyInflow = 68000,
  monthlyOutflow = 35000,
  stressIndex = 0.32,
  totalBurdenRatio = 0.48,
  bufferRatio = 0.22,
} = {}) => {
  const safePurchaseAmount = Number.isFinite(purchaseAmount) && purchaseAmount > 0 ? purchaseAmount : 21999;
  const safeTenureWeeks = Number.isFinite(tenureWeeks) && tenureWeeks > 0 ? Math.round(tenureWeeks) : 24;
  const safeMonthlyInflow = Number.isFinite(monthlyInflow) && monthlyInflow > 0 ? monthlyInflow : 68000;
  const safeMonthlyOutflow =
    Number.isFinite(monthlyOutflow) && monthlyOutflow >= 0 ? monthlyOutflow : safeMonthlyInflow * 0.5;
  const monthlyInstallment = Math.max(safePurchaseAmount / Math.max(safeTenureWeeks / 4, 1), 1);
  const purchaseToInflow = Math.max(0, safePurchaseAmount / Math.max(safeMonthlyInflow, 1));
  const installmentToInflow = Math.max(0, monthlyInstallment / Math.max(safeMonthlyInflow, 1));
  const minBalance = Math.max(500, safeMonthlyInflow * bufferRatio);
  const avgBalance = Math.max(minBalance, safeMonthlyInflow * 0.24);

  return {
    segment,
    monthly_inflow: Number(safeMonthlyInflow.toFixed(6)),
    monthly_outflow: Number(safeMonthlyOutflow.toFixed(6)),
    inflow_volatility_90d: 0.22,
    outflow_volatility_90d: 0.28,
    deposit_count_30d: 4,
    days_since_last_income: 5,
    avg_balance_30d: Number(avgBalance.toFixed(6)),
    min_balance_30d: Number(minBalance.toFixed(6)),
    negative_balance_days_30d: 0,
    essential_spend_ratio: Number(Math.min(1, safeMonthlyOutflow / safeMonthlyInflow).toFixed(6)),
    active_loan_count: 1,
    monthly_installment_burden: Number(monthlyInstallment.toFixed(6)),
    purchase_amount: Number(safePurchaseAmount.toFixed(6)),
    tenure_weeks: safeTenureWeeks,
    purchase_to_inflow_ratio: Number(purchaseToInflow.toFixed(6)),
    installment_to_inflow_ratio: Number(installmentToInflow.toFixed(6)),
    total_burden_ratio: Number(totalBurdenRatio.toFixed(6)),
    buffer_ratio: Number(bufferRatio.toFixed(6)),
    stress_index: Number(stressIndex.toFixed(6)),
  };
};
