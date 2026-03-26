#!/usr/bin/env node
/**
 * FairLens end-to-end demo readiness orchestration.
 *
 * Provisions real Supabase Auth demo users, maps roles, seeds deterministic data,
 * and runs runtime verification against the deployed Worker API.
 *
 * Required env:
 *  SUPABASE_URL
 *  SUPABASE_SERVICE_ROLE_KEY
 *  SUPABASE_ANON_KEY
 *  DEMO_ADMIN_EMAIL
 *  DEMO_ADMIN_PASSWORD
 *  DEMO_USER_EMAIL
 *  DEMO_USER_PASSWORD
 *  SMOKE_BASE_URL
 *
 * Optional:
 *  DEMO_RESET=true|false (default true; overridden by --no-reset)
 *
 * Flags:
 *  --no-reset
 *  --dry-run
 *  --help
 */

import { spawn } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  buildAssessmentFeaturePayload,
  collectDemoReadyConfig,
  extractAccessToken,
  mergeArgFlags,
} from './lib/demo-ready-lib.mjs';

const flags = mergeArgFlags();

const helpText = `FairLens demo readiness

Environment:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_ANON_KEY
  DEMO_ADMIN_EMAIL
  DEMO_ADMIN_PASSWORD
  DEMO_USER_EMAIL
  DEMO_USER_PASSWORD
  SMOKE_BASE_URL

Optional:
  DEMO_RESET=true|false       Default true

Flags:
  --no-reset                  Skip seed reset phase
  --dry-run                   Print plan only, no writes
  --help                      Show this help text
`;

if (flags.has('--help') || flags.has('-h')) {
  console.log(helpText);
  process.exit(0);
}

const log = (message) => console.log(`[demo-ready] ${message}`);

const fail = (message) => {
  throw new Error(message);
};

const readJsonResponse = async (response, context) => {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    fail(`${context} returned non-JSON response`);
  }
};

const assertHttp = async (response, context, expectedStatuses = [200]) => {
  if (expectedStatuses.includes(response.status)) {
    return;
  }
  const body = await readJsonResponse(response, context);
  const detail =
    body && typeof body === 'object'
      ? JSON.stringify(body)
      : `${response.status} ${response.statusText}`;
  fail(`${context} failed with status ${response.status}: ${detail}`);
};

const authAdminRequest = async (config, path, { method = 'GET', body } = {}) => {
  const response = await fetch(`${config.supabaseUrl}/auth/v1${path}`, {
    method,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  await assertHttp(response, `Supabase auth ${method} ${path}`, [200, 201]);
  return readJsonResponse(response, `Supabase auth ${method} ${path}`);
};

const restRequest = async (config, table, { method, query = {}, body, prefer = 'return=representation' }) => {
  const url = new URL(`${config.supabaseUrl}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && String(value).length > 0) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      Prefer: prefer,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  await assertHttp(response, `Supabase rest ${method} ${url.pathname}${url.search}`, [200, 201, 204]);
  return readJsonResponse(response, `Supabase rest ${method} ${url.pathname}${url.search}`);
};

const listAuthUsers = async (config, { perPage = 200, maxPages = 20 } = {}) => {
  const users = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const payload = await authAdminRequest(
      config,
      `/admin/users?page=${page}&per_page=${perPage}`,
      { method: 'GET' }
    );
    const pageUsers = Array.isArray(payload?.users) ? payload.users : [];
    users.push(...pageUsers);
    if (pageUsers.length < perPage) {
      break;
    }
  }
  return users;
};

const findAuthUserByEmail = async (config, email) => {
  const users = await listAuthUsers(config);
  return (
    users.find((user) => {
      const userEmail = typeof user?.email === 'string' ? user.email.toLowerCase() : '';
      return userEmail === email.toLowerCase();
    }) ?? null
  );
};

const ensureAuthUser = async (config, account) => {
  const existing = await findAuthUserByEmail(config, account.email);
  const metadata = {
    demo_ready: true,
    demo_role: account.role,
    display_name: account.role === 'admin' ? 'Demo Admin' : 'Demo User',
  };

  if (!existing) {
    const created = await authAdminRequest(config, '/admin/users', {
      method: 'POST',
      body: {
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: metadata,
        app_metadata: { demo_ready: true, demo_role: account.role },
      },
    });
    const userId = created?.id;
    if (typeof userId !== 'string' || userId.trim().length === 0) {
      fail(`Auth user creation returned no id for ${account.label}`);
    }
    return { id: userId, email: account.email, created: true };
  }

  const userId = typeof existing.id === 'string' ? existing.id : '';
  if (!userId) {
    fail(`Existing auth user for ${account.label} has no id`);
  }

  await authAdminRequest(config, `/admin/users/${userId}`, {
    method: 'PUT',
    body: {
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: { demo_ready: true, demo_role: account.role },
    },
  });

  return { id: userId, email: account.email, created: false };
};

const upsertRoleMapping = async (config, { userId, role }) => {
  await restRequest(config, 'user_roles', {
    method: 'POST',
    query: { on_conflict: 'user_id' },
    body: [{ user_id: userId, role }],
    prefer: 'resolution=merge-duplicates,return=representation',
  });
};

const runSeedScript = async (config, roleMappings) => {
  const scriptPath = fileURLToPath(new URL('./demo-seed.mjs', import.meta.url));
  const childArgs = [scriptPath];
  if (!config.shouldReset) {
    childArgs.push('--no-reset');
  }
  if (config.dryRun) {
    childArgs.push('--dry-run');
  }

  const env = {
    ...process.env,
    SUPABASE_URL: config.supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: config.serviceRoleKey,
    DEMO_ADMIN_USER_ID: roleMappings.adminUserId,
    DEMO_USER_USER_ID: roleMappings.userUserId,
  };

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, childArgs, {
      stdio: 'inherit',
      env,
      cwd: process.cwd(),
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`demo-seed exited with code ${code ?? 'unknown'}`));
    });
  });
};

const loginWithPassword = async (config, account) => {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: account.email,
      password: account.password,
    }),
  });

  await assertHttp(response, `Supabase login ${account.label}`, [200]);
  const payload = await readJsonResponse(response, `Supabase login ${account.label}`);
  const token = extractAccessToken(payload);
  if (!token) {
    fail(`Supabase login did not return access_token for ${account.label}`);
  }
  return token;
};

const generateKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const callWorker = async (
  config,
  path,
  { method = 'GET', token = null, body, expectedStatuses = [200], headers = {} } = {}
) => {
  const requestHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };
  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${config.smokeBaseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await readJsonResponse(response, `Worker ${method} ${path}`);
  if (!payload || typeof payload !== 'object') {
    fail(`Worker ${method} ${path} returned empty payload`);
  }

  if (!('data' in payload) || !('error' in payload) || !('meta' in payload)) {
    fail(`Worker ${method} ${path} returned invalid envelope`);
  }

  if (!expectedStatuses.includes(response.status)) {
    const errMessage =
      payload?.error && typeof payload.error === 'object' && typeof payload.error.message === 'string'
        ? payload.error.message
        : `${response.status} ${response.statusText}`;
    fail(`Worker ${method} ${path} failed with status ${response.status}: ${errMessage}`);
  }

  return { status: response.status, payload };
};

const assertRoleContains = (roles, expectedRole, label) => {
  if (!Array.isArray(roles)) {
    fail(`${label} roles payload is invalid`);
  }
  const normalized = roles.map((role) => String(role).trim().toLowerCase());
  if (!normalized.includes(expectedRole.toLowerCase())) {
    fail(`${label} roles do not include ${expectedRole}`);
  }
};

const runWorkerVerification = async (config, { userToken, adminToken }) => {
  log('Verifying worker health and auth routes...');
  const health = await callWorker(config, '/health');
  if (health.payload?.data?.status !== 'ok') {
    fail('/health did not return status=ok');
  }

  const userAuth = await callWorker(config, '/auth/me', { token: userToken });
  if (userAuth.payload?.data?.is_authenticated !== true) {
    fail('User token is not authenticated on /auth/me');
  }
  assertRoleContains(userAuth.payload?.data?.roles, 'user', 'User');

  const adminAuth = await callWorker(config, '/auth/me', { token: adminToken });
  if (adminAuth.payload?.data?.is_authenticated !== true) {
    fail('Admin token is not authenticated on /auth/me');
  }
  assertRoleContains(adminAuth.payload?.data?.roles, 'admin', 'Admin');

  log('Verifying user/admin access boundaries...');
  await callWorker(config, '/v1/applications/me?page=1&limit=1', { token: userToken });
  await callWorker(config, '/v1/stats', { token: userToken, expectedStatuses: [403] });
  await callWorker(config, '/v1/stats', { token: adminToken });
  await callWorker(config, '/v1/admin/assessments?page=1&limit=10', { token: adminToken });

  log('Running statement-first scoring gate (low-risk + high-risk payloads)...');
  const createAssessment = async ({ token, features, label }) => {
    const documentRequest = await callWorker(config, '/v1/documents', {
      method: 'POST',
      token,
      headers: { 'Idempotency-Key': generateKey() },
      body: {
        storage_key: `demo-ready/${label}-${Date.now()}.csv`,
        file_name: `${label}.csv`,
        mime_type: 'text/csv',
        source: 'demo_ready',
      },
      expectedStatuses: [201],
    });

    const documentId = documentRequest.payload?.data?.id;
    if (typeof documentId !== 'string' || !documentId.trim()) {
      fail(`Document creation did not return id for ${label}`);
    }

    const assessment = await callWorker(config, '/v1/assessments', {
      method: 'POST',
      token,
      headers: { 'Idempotency-Key': generateKey() },
      body: {
        document_id: documentId,
        features,
      },
      expectedStatuses: [201],
    });

    const assessmentId = assessment.payload?.data?.id;
    const decision = assessment.payload?.data?.final_decision;
    if (typeof assessmentId !== 'string' || !assessmentId.trim()) {
      fail(`Assessment creation did not return id for ${label}`);
    }
    if (decision !== 'Approve' && decision !== 'Decline') {
      fail(`Assessment decision is invalid for ${label}`);
    }
    return { assessmentId, decision };
  };

  const lowRisk = await createAssessment({
    token: userToken,
    label: 'low-risk',
    features: buildAssessmentFeaturePayload({
      purchaseAmount: 18999,
      tenureWeeks: 24,
      segment: 'student',
      monthlyInflow: 74000,
      monthlyOutflow: 32000,
      stressIndex: 0.24,
      totalBurdenRatio: 0.41,
      bufferRatio: 0.31,
    }),
  });

  const highRisk = await createAssessment({
    token: userToken,
    label: 'high-risk',
    features: buildAssessmentFeaturePayload({
      purchaseAmount: 49999,
      tenureWeeks: 16,
      segment: 'gig_worker',
      monthlyInflow: 26000,
      monthlyOutflow: 24500,
      stressIndex: 0.78,
      totalBurdenRatio: 0.88,
      bufferRatio: 0.06,
    }),
  });

  const adminAssessments = await callWorker(config, '/v1/admin/assessments?page=1&limit=50', {
    token: adminToken,
  });
  const items = Array.isArray(adminAssessments.payload?.data?.items)
    ? adminAssessments.payload.data.items
    : [];
  const ids = new Set(items.map((item) => item?.id).filter((value) => typeof value === 'string'));
  if (!ids.has(lowRisk.assessmentId) || !ids.has(highRisk.assessmentId)) {
    fail('Freshly created verification assessments are missing from admin listing');
  }

  return {
    lowRisk,
    highRisk,
    adminAssessmentCount: items.length,
  };
};

const main = async () => {
  const config = collectDemoReadyConfig(process.env, flags);

  log('Configuration loaded.');
  log(
    JSON.stringify(
      {
        supabaseUrl: config.supabaseUrl,
        smokeBaseUrl: config.smokeBaseUrl,
        shouldReset: config.shouldReset,
        dryRun: config.dryRun,
        adminEmail: config.admin.email,
        userEmail: config.user.email,
      },
      null,
      2
    )
  );

  if (config.dryRun) {
    log('Dry-run mode: no writes executed.');
    return;
  }

  log('Provisioning Supabase Auth users...');
  const adminIdentity = await ensureAuthUser(config, config.admin);
  const userIdentity = await ensureAuthUser(config, config.user);
  log(`Admin user: ${adminIdentity.created ? 'created' : 'updated'} (${adminIdentity.email})`);
  log(`Regular user: ${userIdentity.created ? 'created' : 'updated'} (${userIdentity.email})`);

  log('Upserting role mappings...');
  await upsertRoleMapping(config, { userId: adminIdentity.id, role: 'admin' });
  await upsertRoleMapping(config, { userId: userIdentity.id, role: 'user' });
  log('Role mappings updated.');

  log('Running deterministic demo seed...');
  await runSeedScript(config, {
    adminUserId: adminIdentity.id,
    userUserId: userIdentity.id,
  });
  log('Seed complete.');

  log('Logging in demo accounts...');
  const userToken = await loginWithPassword(config, config.user);
  const adminToken = await loginWithPassword(config, config.admin);
  log('Login checks passed.');

  const verification = await runWorkerVerification(config, {
    userToken,
    adminToken,
  });

  log('Demo-ready verification succeeded.');
  console.log(
    JSON.stringify(
      {
        demoReady: true,
        users: {
          admin: { email: config.admin.email, userId: adminIdentity.id },
          user: { email: config.user.email, userId: userIdentity.id },
        },
        seed: {
          resetApplied: config.shouldReset,
        },
        verification,
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(
    `[demo-ready] FAIL: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
