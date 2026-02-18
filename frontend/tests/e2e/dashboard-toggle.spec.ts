import { test, expect } from '@playwright/test';

const statsResponse = {
  total_predictions: 5,
  approval_rate: 0.6,
  decline_rate: 0.4,
  risk_score_distribution: { low: 2, medium: 2, high: 1 },
};

const logsResponse = {
  page: 1,
  limit: 10,
  total: 1,
  total_pages: 1,
  items: [
    {
      id: 101,
      avg_monthly_inflow: 90000,
      inflow_volatility: 0.2,
      avg_monthly_outflow: 50000,
      min_balance_30d: 12000,
      neg_balance_days_30d: 1,
      purchase_to_inflow_ratio: 0.3,
      total_burden_ratio: 0.5,
      buffer_ratio: 0.18,
      stress_index: 0.42,
      risk_probability: 0.28,
      decision: 'Approve',
      created_at: '2026-02-16T12:20:00Z',
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
});

test('toggles between demo and live dashboard modes', async ({ page }) => {
  await page.route('**/stats', async (route) => {
    await route.fulfill({ json: statsResponse });
  });
  await page.route('**/logs**', async (route) => {
    await route.fulfill({ json: logsResponse });
  });

  await page.goto('/dashboard');

  await expect(page.getByText('Demo Data')).toBeVisible();
  await page.getByRole('button', { name: 'Switch to live' }).click();
  await expect(page.getByText('Live Data')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Switch to demo' })).toBeVisible();
});