import { expect, test } from '@playwright/test';

test('legacy routes redirect to demo entry points', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL('**/shop');

  await page.goto('/product/mbp-m3-max-001');
  await page.waitForURL('**/shop');

  await page.goto('/admin/login');
  await page.waitForURL('**/login?role=admin');
});
