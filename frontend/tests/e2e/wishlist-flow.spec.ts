import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
});

test('saves a product to the wishlist', async ({ page }) => {
  await page.goto('/product/mbp-m3-max-001');
  await page.getByRole('button', { name: 'Save to wishlist' }).click();
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem('fairlens-store-v1');
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      return Array.isArray(data.wishlist) && data.wishlist.length > 0;
    } catch {
      return false;
    }
  });

  await page.goto('/wishlist');
  await expect(page.getByRole('heading', { name: 'Saved items' })).toBeVisible();
  await expect(page.getByText('MacBook Pro 16-inch M3 Max')).toBeVisible();
});