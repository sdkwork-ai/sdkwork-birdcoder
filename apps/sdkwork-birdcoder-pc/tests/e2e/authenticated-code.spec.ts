import { expect, test } from '@playwright/test';

test('password sign-in lands on the authenticated code workbench', async ({ page }) => {
  await page.goto('/#/auth/login');

  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toBeVisible({
    timeout: 45_000,
  });

  await page.locator('input[type="password"]').first().fill('e2e-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toHaveCount(0, {
    timeout: 45_000,
  });
  await expect(page.getByText('Starting SDKWork BirdCoder')).toHaveCount(0);

  await expect(page.getByText('New Project')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Sessions')).toBeVisible();
  await expect(page.getByText('Project Templates')).toHaveCount(0);
});
