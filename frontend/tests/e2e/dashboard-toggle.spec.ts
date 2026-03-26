import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard');
  await page.evaluate(() => window.localStorage.clear());
});

test('shows recent decisions and runs manager eligibility check', async ({ page }) => {
  await page.route('**/v1/admin/assessments**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          page: 1,
          limit: 30,
          total: 1,
          total_pages: 1,
          items: [
            {
              id: 'asm-admin-1',
              owner_sub: 'auth0|demo-user',
              document_id: 'doc-1',
              extracted_feature_id: 'feat-1',
              risk_probability: 0.37,
              auto_decision: 'Approve',
              final_decision: 'Approve',
              decision_source: 'auto',
              created_at: '2026-03-26T10:00:00.000Z',
            },
          ],
        },
        error: null,
        meta: { requestId: 'req-admin-asm', timestamp: new Date().toISOString() },
      }),
    });
  });

  await page.route('**/v1/documents', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'doc-manager-1',
          storage_key: 'uploads/mock.csv',
          extraction_job_id: null,
          extraction_job_status: null,
        },
        error: null,
        meta: { requestId: 'req-doc-1', timestamp: new Date().toISOString() },
      }),
    });
  });

  await page.route('**/v1/assessments', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'asm-manager-2',
          owner_sub: 'auth0|bank-admin',
          document_id: 'doc-manager-1',
          extracted_feature_id: 'feat-2',
          risk_probability: 0.73,
          auto_decision: 'Decline',
          final_decision: 'Decline',
          decision_source: 'auto',
          model_source: 'ml_service',
          reasons: [
            {
              code: 'HIGH_BURDEN_RATIO',
              feature: 'total_burden_ratio',
              direction: 'up',
              impact: 0.81,
              message: 'Monthly burden is high relative to inflow.',
            },
          ],
        },
        error: null,
        meta: { requestId: 'req-asm-2', timestamp: new Date().toISOString() },
      }),
    });
  });

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Recent decisions and manager checks' })).toBeVisible();
  await expect(page.getByText('auth0|demo-user')).toBeVisible();

  await page.setInputFiles('input[type="file"]', {
    name: 'statement.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('date,amount,balance,direction\n2026-03-01,12000,23000,credit\n'),
  });
  await page.getByRole('button', { name: 'Run eligibility check' }).click();

  await expect(page.getByText('Declined for requested amount/tenure.')).toBeVisible();
  await expect(page.getByText('Monthly burden is high relative to inflow.')).toBeVisible();
});
