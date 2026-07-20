import { expect, test } from '@playwright/test';

test('boot shell renders the BirdCoder startup surface', async ({ page }) => {
  await page.route('**/readyz', async (route) => {
    await new Promise((resolve) => globalThis.setTimeout(resolve, 1_500));
    await route.continue();
  });

  await page.goto('/');

  await expect(page).toHaveTitle(/SDKWork BirdCoder/u);
  await expect(page.getByRole('heading', { name: 'SDKWork BirdCoder', exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '36');
  await expect(page.locator('[data-birdcoder-boot-shell]')).toHaveCount(1);
  await expect(page.locator('.sdkwork-startup-stages')).toBeVisible();
});
