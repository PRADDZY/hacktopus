import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
});

test('completes an EMI checkout flow', async ({ page }) => {
  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.route('**/predict', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        decision: 'Approve',
        risk_probability: 0.12,
        model_version: 'ensemble-catboost-ft-v1',
        schema_version: 'risk-v2.0.0',
        calibration_bucket: 'very_low',
        reasons: [],
      }),
    });
  });
  await page.goto('/');

  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('link', { name: 'Cart' }).click();
  await page.getByRole('link', { name: 'Proceed to checkout' }).click();

  await page.getByPlaceholder('Full Name').fill('Ava Patel');
  await page.getByPlaceholder('Phone').fill('9876543210');
  await page.getByPlaceholder('Address Line 1').fill('12 Park Street');
  await page.getByPlaceholder('Address Line 2').fill('Suite 5');
  await page.getByPlaceholder('City').fill('Mumbai');
  await page.getByPlaceholder('State').fill('MH');
  await page.getByPlaceholder('Pincode').fill('400001');
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page.getByText('Ava Patel')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Delivery options' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Payment method' })).toBeVisible();

  await page.getByRole('radio', { name: 'No Cost EMI' }).check();
  await page.getByRole('combobox').selectOption({ label: 'HDFC Bank' });
  await page.getByRole('radio', { name: 'Credit card' }).check();
  await page.getByPlaceholder('Card last 4 digits').fill('1234');
  await page.getByPlaceholder('Monthly income (INR)').fill('85000');
  await page.setInputFiles('input[type="file"]', {
    name: '1.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('sample file'),
  });
  await page.getByRole('button', { name: 'Check EMI eligibility' }).click();

  await expect(page.getByRole('heading', { name: 'EMI Approved' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('button', { name: 'Review order' }).click();
  await expect(page.getByRole('heading', { name: 'Review & place order' })).toBeVisible();
  await page.getByRole('button', { name: 'Place order' }).click();

  await page.waitForURL('**/orders');
  await expect(page.getByText('MacBook Pro 16-inch M3 Max')).toBeVisible();
});
