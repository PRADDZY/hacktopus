#!/usr/bin/env node
/**
 * FairLens demo seed script for Supabase.
 *
 * Seeds deterministic admin dashboard data (applications + audit logs)
 * and can optionally map known auth users to user/admin roles.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:demo
 *
 * Optional:
 *   DEMO_ADMIN_USER_ID=<uuid>  -> upsert role=admin
 *   DEMO_USER_USER_ID=<uuid>   -> upsert role=user
 *   --no-reset                 -> skip cleanup step
 *   --dry-run                  -> print actions only
 */

import process from 'node:process';

const args = new Set(process.argv.slice(2));

const printHelp = () => {
  console.log(`FairLens demo seed

Environment:
  SUPABASE_URL                  Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY     Supabase service role key
  DEMO_ADMIN_USER_ID            Optional auth.users UUID to map as admin
  DEMO_USER_USER_ID             Optional auth.users UUID to map as user

Options:
  --no-reset     Skip cleanup before seeding
  --dry-run      Print planned actions without writing data
  --help         Show this help text
`);
};

if (args.has('--help') || args.has('-h')) {
  printHelp();
  process.exit(0);
}

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const shouldReset = !args.has('--no-reset');
const dryRun = args.has('--dry-run');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const now = new Date().toISOString();
const demoTransactions = [
  {
    application_uuid: 'demo_app_001',
    user_sub: 'demo-user-student',
    avg_monthly_inflow: 52000,
    inflow_volatility: 0.16,
    avg_monthly_outflow: 33800,
    min_balance_30d: 12800,
    neg_balance_days_30d: 0,
    purchase_to_inflow_ratio: 0.29,
    total_burden_ratio: 0.42,
    buffer_ratio: 0.33,
    stress_index: 0.24,
    risk_probability: 0.24,
    decision: 'Approve',
    auto_decision: 'Approve',
    final_decision: 'Approve',
    decision_source: 'auto',
    order_amount_inr: 14999,
    tenure_months: 6,
    monthly_income_inr: 52000,
    bank: 'Axis Bank',
    card_type: 'Debit',
    card_last_four_masked: '4021',
    model_source: 'ml_service_v2',
    reviewed_by: null,
    reviewed_at: null,
    override_reason: null,
    updated_at: now,
  },
  {
    application_uuid: 'demo_app_002',
    user_sub: 'demo-user-gig',
    avg_monthly_inflow: 31000,
    inflow_volatility: 0.34,
    avg_monthly_outflow: 25800,
    min_balance_30d: 2200,
    neg_balance_days_30d: 4,
    purchase_to_inflow_ratio: 0.51,
    total_burden_ratio: 0.67,
    buffer_ratio: 0.12,
    stress_index: 0.58,
    risk_probability: 0.69,
    decision: 'Decline',
    auto_decision: 'Decline',
    final_decision: 'Decline',
    decision_source: 'auto',
    order_amount_inr: 28999,
    tenure_months: 9,
    monthly_income_inr: 31000,
    bank: 'HDFC Bank',
    card_type: 'Debit',
    card_last_four_masked: '8813',
    model_source: 'ml_service_v2',
    reviewed_by: null,
    reviewed_at: null,
    override_reason: null,
    updated_at: now,
  },
  {
    application_uuid: 'demo_app_003',
    user_sub: 'demo-user-freelance',
    avg_monthly_inflow: 47000,
    inflow_volatility: 0.28,
    avg_monthly_outflow: 30100,
    min_balance_30d: 6900,
    neg_balance_days_30d: 1,
    purchase_to_inflow_ratio: 0.44,
    total_burden_ratio: 0.59,
    buffer_ratio: 0.21,
    stress_index: 0.41,
    risk_probability: 0.56,
    decision: 'Decline',
    auto_decision: 'Decline',
    final_decision: 'Approve',
    decision_source: 'manual_override',
    order_amount_inr: 19999,
    tenure_months: 8,
    monthly_income_inr: 47000,
    bank: 'Kotak Mahindra',
    card_type: 'Credit',
    card_last_four_masked: '1145',
    model_source: 'ml_service_v2',
    reviewed_by: 'risk.lead@fairlens.ai',
    reviewed_at: now,
    override_reason: 'Stable recent inflow trend and verified contract invoice.',
    updated_at: now,
  },
  {
    application_uuid: 'demo_app_004',
    user_sub: 'demo-user-informal',
    avg_monthly_inflow: 26500,
    inflow_volatility: 0.39,
    avg_monthly_outflow: 20600,
    min_balance_30d: 1200,
    neg_balance_days_30d: 5,
    purchase_to_inflow_ratio: 0.48,
    total_burden_ratio: 0.62,
    buffer_ratio: 0.09,
    stress_index: 0.67,
    risk_probability: 0.63,
    decision: 'Decline',
    auto_decision: 'Decline',
    final_decision: 'Decline',
    decision_source: 'auto',
    order_amount_inr: 13999,
    tenure_months: 6,
    monthly_income_inr: 26500,
    bank: 'SBI',
    card_type: 'Debit',
    card_last_four_masked: '6402',
    model_source: 'ml_service_v2',
    reviewed_by: null,
    reviewed_at: null,
    override_reason: null,
    updated_at: now,
  },
];

const demoAuditLogs = [
  {
    actor: 'system@fairlens.ai',
    action: 'Application scored',
    details: 'Decision Approve (risk 0.240) for APP-demo_app_001',
    status: 'success',
    entity_id: 'demo_app_001',
    source: 'demo_seed',
  },
  {
    actor: 'system@fairlens.ai',
    action: 'Application scored',
    details: 'Decision Decline (risk 0.690) for APP-demo_app_002',
    status: 'warning',
    entity_id: 'demo_app_002',
    source: 'demo_seed',
  },
  {
    actor: 'risk.lead@fairlens.ai',
    action: 'Manual override',
    details: 'Application APP-demo_app_003 manually set to Approve: Stable recent inflow trend and verified contract invoice.',
    status: 'warning',
    entity_id: 'demo_app_003',
    source: 'demo_seed',
  },
  {
    actor: 'system@fairlens.ai',
    action: 'Application scored',
    details: 'Decision Decline (risk 0.630) for APP-demo_app_004',
    status: 'warning',
    entity_id: 'demo_app_004',
    source: 'demo_seed',
  },
];

const request = async (method, table, { query = {}, body, prefer = 'return=representation' } = {}) => {
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && String(value).length > 0) {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    Prefer: prefer,
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${method} ${url.pathname} failed (${response.status}): ${text}`);
  }

  if (response.status === 204) {
    return null;
  }
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }
  return JSON.parse(text);
};

const upsertRole = async (userId, role) => {
  if (!userId) {
    return false;
  }
  if (!isUuid(userId)) {
    throw new Error(`Invalid UUID for ${role} mapping: ${userId}`);
  }
  await request('POST', 'user_roles', {
    query: { on_conflict: 'user_id' },
    body: [{ user_id: userId, role }],
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  return true;
};

const printPlan = () => {
  console.log(`Seed plan:
- reset before seed: ${shouldReset ? 'yes' : 'no'}
- demo applications: ${demoTransactions.length}
- demo audit logs: ${demoAuditLogs.length}
- admin role mapping: ${process.env.DEMO_ADMIN_USER_ID ? 'yes' : 'no'}
- user role mapping: ${process.env.DEMO_USER_USER_ID ? 'yes' : 'no'}
`);
};

const run = async () => {
  printPlan();

  if (dryRun) {
    console.log('Dry run enabled: no writes executed.');
    return;
  }

  if (shouldReset) {
    const ids = demoTransactions.map((row) => row.application_uuid).join(',');
    await request('DELETE', 'audit_logs', {
      query: { source: 'eq.demo_seed' },
      prefer: 'return=minimal',
    });
    await request('DELETE', 'transactions', {
      query: { application_uuid: `in.(${ids})` },
      prefer: 'return=minimal',
    });
  }

  const seededTransactions = await request('POST', 'transactions', {
    query: { on_conflict: 'application_uuid' },
    body: demoTransactions,
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  const seededAuditLogs = await request('POST', 'audit_logs', {
    body: demoAuditLogs,
    prefer: 'return=representation',
  });

  const adminMapped = await upsertRole(process.env.DEMO_ADMIN_USER_ID, 'admin');
  const userMapped = await upsertRole(process.env.DEMO_USER_USER_ID, 'user');

  console.log('Demo seed completed.');
  console.log(
    JSON.stringify(
      {
        transactions: Array.isArray(seededTransactions) ? seededTransactions.length : 0,
        auditLogs: Array.isArray(seededAuditLogs) ? seededAuditLogs.length : 0,
        roleMappings: {
          admin: adminMapped,
          user: userMapped,
        },
      },
      null,
      2,
    ),
  );
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
