#!/usr/bin/env node

/**
 * FairLens demo smoke script.
 *
 * Usage:
 *   SMOKE_BASE_URL=https://<worker-url> node scripts/demo-smoke.mjs
 *
 * Optional:
 *   SMOKE_BEARER_TOKEN=<jwt>        # run authenticated checks
 *   SMOKE_CHECK_ADMIN=true          # assert /v1/stats with token (admin only)
 */

const baseUrl = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const bearerToken = process.env.SMOKE_BEARER_TOKEN || '';
const checkAdmin = ['1', 'true', 'yes'].includes((process.env.SMOKE_CHECK_ADMIN || '').toLowerCase());

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`FairLens worker smoke checks

Environment:
  SMOKE_BASE_URL      Worker base URL (default: http://127.0.0.1:8787)
  SMOKE_BEARER_TOKEN  Optional JWT for authenticated checks
  SMOKE_CHECK_ADMIN   true/1/yes to assert /v1/stats as admin
`);
  process.exit(0);
}

const log = (message) => console.log(`[smoke] ${message}`);

const fail = (message) => {
  console.error(`[smoke] FAIL: ${message}`);
  process.exit(1);
};

const parseJson = async (response, route) => {
  const text = await response.text();
  if (!text.trim()) {
    fail(`${route} returned empty body`);
  }
  try {
    return JSON.parse(text);
  } catch {
    fail(`${route} returned non-JSON response`);
  }
};

const assertEnvelope = (payload, route) => {
  if (!payload || typeof payload !== 'object') {
    fail(`${route} did not return an object envelope`);
  }
  if (!Object.prototype.hasOwnProperty.call(payload, 'data')) {
    fail(`${route} envelope missing data`);
  }
  if (!Object.prototype.hasOwnProperty.call(payload, 'error')) {
    fail(`${route} envelope missing error`);
  }
  if (!Object.prototype.hasOwnProperty.call(payload, 'meta')) {
    fail(`${route} envelope missing meta`);
  }
};

const call = async (route, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  }).catch((error) => {
    fail(`${route} request failed: ${error instanceof Error ? error.message : String(error)}`);
  });

  const payload = await parseJson(response, route);
  assertEnvelope(payload, route);

  if (!response.ok) {
    const message = payload?.error?.message || `status ${response.status}`;
    fail(`${route} failed: ${message}`);
  }

  return payload;
};

const main = async () => {
  log(`Base URL: ${baseUrl}`);

  const health = await call('/health');
  if (health.data?.status !== 'ok') {
    fail('/health status is not ok');
  }
  log('Health check passed');

  const assistant = await call('/v1/assistant/query', {
    method: 'POST',
    body: {
      message: 'How to resolve EMI approval issue?',
      context: { page: '/checkout' },
    },
  });
  if (!assistant.data?.reply) {
    fail('/v1/assistant/query reply missing');
  }
  log('Assistant check passed');

  const authMe = await call('/auth/me');
  const isAuthenticated = Boolean(authMe.data?.is_authenticated);
  log(`Auth context check passed (authenticated=${isAuthenticated})`);

  if (bearerToken) {
    await call('/v1/applications/me?page=1&limit=1');
    log('Authenticated applications listing passed');
  } else {
    log('Skipping authenticated route checks (no SMOKE_BEARER_TOKEN provided)');
  }

  if (checkAdmin) {
    if (!bearerToken) {
      fail('SMOKE_CHECK_ADMIN=true requires SMOKE_BEARER_TOKEN');
    }
    await call('/v1/stats');
    log('Admin stats check passed');
  } else {
    log('Skipping admin check (SMOKE_CHECK_ADMIN not enabled)');
  }

  log('All smoke checks passed');
};

await main();
