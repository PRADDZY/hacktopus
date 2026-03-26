import { describe, expect, it } from 'vitest';
import {
  buildAssessmentFeaturePayload,
  collectDemoReadyConfig,
  extractAccessToken,
  mergeArgFlags,
} from '../scripts/lib/demo-ready-lib.mjs';

describe('demo-ready-lib', () => {
  it('collects config from required env vars', () => {
    const config = collectDemoReadyConfig(
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        SUPABASE_ANON_KEY: 'anon-key',
        DEMO_ADMIN_EMAIL: 'admin@fairlens.ai',
        DEMO_ADMIN_PASSWORD: 'password-a',
        DEMO_USER_EMAIL: 'user@fairlens.ai',
        DEMO_USER_PASSWORD: 'password-u',
        SMOKE_BASE_URL: 'https://worker.example.workers.dev',
      },
      new Set(),
    );

    expect(config.supabaseUrl).toBe('https://example.supabase.co');
    expect(config.shouldReset).toBe(true);
    expect(config.dryRun).toBe(false);
    expect(config.admin.email).toBe('admin@fairlens.ai');
    expect(config.user.email).toBe('user@fairlens.ai');
  });

  it('supports no-reset and dry-run flags', () => {
    const config = collectDemoReadyConfig(
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        SUPABASE_ANON_KEY: 'anon-key',
        DEMO_ADMIN_EMAIL: 'admin@fairlens.ai',
        DEMO_ADMIN_PASSWORD: 'password-a',
        DEMO_USER_EMAIL: 'user@fairlens.ai',
        DEMO_USER_PASSWORD: 'password-u',
        SMOKE_BASE_URL: 'https://worker.example.workers.dev',
      },
      new Set(['--no-reset', '--dry-run']),
    );

    expect(config.shouldReset).toBe(false);
    expect(config.dryRun).toBe(true);
  });

  it('throws when required vars are missing', () => {
    expect(() =>
      collectDemoReadyConfig(
        {
          SUPABASE_URL: 'https://example.supabase.co',
        },
        new Set(),
      ),
    ).toThrow(/Missing required environment/i);
  });

  it('extracts access token from supabase auth payload', () => {
    expect(extractAccessToken({ access_token: 'abc-token' })).toBe('abc-token');
    expect(extractAccessToken({})).toBeNull();
  });

  it('builds deterministic feature payload for scoring gate', () => {
    const payload = buildAssessmentFeaturePayload({
      purchaseAmount: 18999,
      tenureWeeks: 24,
      segment: 'gig_worker',
    });

    expect(payload.segment).toBe('gig_worker');
    expect(payload.purchase_amount).toBe(18999);
    expect(payload.tenure_weeks).toBe(24);
    expect(payload.monthly_inflow).toBeGreaterThan(0);
    expect(payload.stress_index).toBeGreaterThanOrEqual(0);
  });

  it('merges command-line flags into a set', () => {
    expect(mergeArgFlags(['--dry-run', '--no-reset']).has('--dry-run')).toBe(true);
    expect(mergeArgFlags([]).size).toBe(0);
  });
});
