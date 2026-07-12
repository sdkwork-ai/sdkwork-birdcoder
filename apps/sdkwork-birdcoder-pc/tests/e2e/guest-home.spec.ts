import { expect, test } from '@playwright/test';

test('guest home redirects to the auth surface', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Sign in')).toBeVisible({ timeout: 60_000 });
});
