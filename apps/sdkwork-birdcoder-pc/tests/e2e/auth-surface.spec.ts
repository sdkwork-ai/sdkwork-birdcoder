import { expect, test } from '@playwright/test';

test('auth hash route renders the IAM auth shell', async ({ page }) => {
  await page.goto('/#/auth/login');

  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.locator('.sdkwork-birdcoder-auth-main')).toBeVisible();
});

test('QR login uses one stable same-origin authorization session', async ({ page }) => {
  const deviceAuthorizationRequests: string[] = [];
  const failedApiRequests: string[] = [];
  page.on('request', (request) => {
    if (
      request.method() === 'POST'
      && new URL(request.url()).pathname === '/app/v3/api/oauth/device_authorizations'
    ) {
      deviceAuthorizationRequests.push(request.url());
    }
  });
  page.on('requestfailed', (request) => {
    if (new URL(request.url()).pathname.startsWith('/app/v3/api/')) {
      failedApiRequests.push(request.url());
    }
  });

  await page.goto('/#/auth/login');
  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toBeVisible({ timeout: 45_000 });
  await page.waitForTimeout(4_000);

  expect(deviceAuthorizationRequests, JSON.stringify(failedApiRequests)).toHaveLength(1);
  expect(new URL(deviceAuthorizationRequests[0]!).origin).toBe(new URL(page.url()).origin);
  expect(failedApiRequests).toEqual([]);

  const qrImage = page.locator('.sdkwork-birdcoder-auth-qr-frame img');
  await expect(qrImage).toBeVisible();
  const initialQrImageSource = await qrImage.getAttribute('src');
  await page.waitForTimeout(4_000);

  expect(deviceAuthorizationRequests).toHaveLength(1);
  await expect(qrImage).toHaveAttribute('src', initialQrImageSource!);
});

test('password sign-in leaves the auth surface', async ({ page }) => {
  await page.goto('/#/auth/login');

  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toBeVisible({ timeout: 45_000 });

  await page.locator('input[type="password"]').first().fill('e2e-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toHaveCount(0, { timeout: 45_000 });
  await expect(page.getByText('Starting SDKWork BirdCoder')).toHaveCount(0);
});
