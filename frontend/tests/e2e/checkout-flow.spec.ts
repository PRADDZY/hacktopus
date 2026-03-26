import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/shop');
  await page.evaluate(() => window.localStorage.clear());
});

test('completes FairLens checkout and lands on success page', async ({ page }) => {
  await page.route('**/v1/documents', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'doc-test-1',
          storage_key: 'uploads/mock.pdf',
          extraction_job_id: 'job-test-1',
          extraction_job_status: 'queued',
        },
        error: null,
        meta: { requestId: 'req-doc-1', timestamp: new Date().toISOString() },
      }),
    });
  });

  await page.route('**/v1/extraction-jobs/job-test-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'job-test-1',
          document_id: 'doc-test-1',
          status: 'completed',
          document_status: 'ready',
        },
        error: null,
        meta: { requestId: 'req-job-1', timestamp: new Date().toISOString() },
      }),
    });
  });

  await page.route('**/v1/assessments', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'asm-test-1',
          owner_sub: 'user-1',
          document_id: 'doc-test-1',
          extracted_feature_id: 'feat-1',
          risk_probability: 0.21,
          auto_decision: 'Approve',
          final_decision: 'Approve',
          decision_source: 'auto',
          model_source: 'ml_service',
          reasons: [
            {
              code: 'BUFFER_RATIO_HEALTHY',
              feature: 'buffer_ratio',
              direction: 'down',
              impact: 0.21,
              message: 'Liquidity buffer supports short-term repayment stability.',
            },
          ],
        },
        error: null,
        meta: { requestId: 'req-asm-1', timestamp: new Date().toISOString() },
      }),
    });
  });

  await page.getByRole('link', { name: 'Buy now' }).click();
  await expect(page.getByRole('heading', { name: 'Complete your demo purchase' })).toBeVisible();

  await page.getByRole('button', { name: 'Start FairLens check' }).click();
  await expect(page.getByRole('heading', { name: 'Upload bank statement' })).toBeVisible();

  await page.setInputFiles('input[type="file"]', {
    name: 'statement.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('statement'),
  });
  await page.getByRole('button', { name: 'Analyze statement' }).click();

  await expect(page.getByText('Credit check passed')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to checkout' }).click();

  await page.waitForURL('**/checkout/success**');
  await expect(page.getByRole('heading', { name: 'Order Placed (Mock)' })).toBeVisible();
});
