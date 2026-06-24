import { expect, test } from '@playwright/test';

test('auth hash route renders the IAM auth shell', async ({ page }) => {
  await page.goto('/#/auth/login');

  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.locator('.sdkwork-birdcoder-auth-main')).toBeVisible();
});

test('password sign-in leaves the auth surface', async ({ page }) => {
  await page.goto('/#/auth/login');

  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toBeVisible({ timeout: 45_000 });

  await page.locator('input[type="password"]').first().fill('e2e-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toHaveCount(0, { timeout: 45_000 });
  await expect(page.getByText('Starting SDKWork BirdCoder')).toHaveCount(0);
});
