import { expect, test } from '@playwright/test';

test('password sign-in lands on the authenticated code workbench', async ({ page }) => {
  await page.goto('/#/auth/login');

  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toBeVisible({
    timeout: 45_000,
  });

  await page.getByRole('textbox', { name: 'Account' }).fill('e2e@test.sdkwork.local');
  await page.locator('input[type="password"]').first().fill('e2e-password');
  const sessionResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/app/v3/api/auth/sessions'
  ));
  await page.getByRole('button', { name: 'Sign in' }).click();
  const sessionResponse = await sessionResponsePromise;
  expect(
    sessionResponse.ok(),
    `Password sign-in failed with HTTP ${sessionResponse.status()}.`,
  ).toBe(true);

  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('sdkwork.birdcoder.appSession.v1');
    if (!raw) {
      return false;
    }
    const session = JSON.parse(raw) as Record<string, unknown>;
    return typeof session.accessToken === 'string' && typeof session.authToken === 'string';
  })).toBe(true);

  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toHaveCount(0, {
    timeout: 45_000,
  });
  await expect(page.getByText('Starting SDKWork BirdCoder')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toHaveCount(0, {
    timeout: 45_000,
  });

  await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText('Sessions')).toBeVisible();
  await expect(page.getByText('Project Templates')).toHaveCount(0);
});
