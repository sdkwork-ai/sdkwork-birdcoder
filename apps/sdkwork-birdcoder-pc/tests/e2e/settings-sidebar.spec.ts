import { expect, test } from '@playwright/test';

test('settings sidebar provides compact grouped navigation and search', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/auth/login');

  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toBeVisible({
    timeout: 45_000,
  });
  await page.getByRole('textbox', { name: 'Account' }).fill('e2e@test.sdkwork.local');
  await page.locator('input[type="password"]').first().fill('e2e-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  const settingsTab = page.getByTitle('Settings').first();
  await expect(settingsTab).toBeVisible({ timeout: 60_000 });
  await settingsTab.click();

  const sidebar = page.getByRole('complementary', { name: 'Settings navigation' });
  await expect(sidebar).toBeVisible({ timeout: 60_000 });
  await expect(sidebar.getByRole('heading', { name: 'Personal' })).toBeVisible();
  await expect(sidebar.getByRole('heading', { name: 'Integrations' })).toBeVisible();
  await expect(sidebar.getByRole('heading', { name: 'Coding' })).toBeVisible();
  await expect(sidebar.getByRole('heading', { name: 'Archived' })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: 'General' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(sidebar.getByRole('button', { name: 'Keyboard Shortcuts' })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: 'Plugins' })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: 'Browser' })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: 'Computer Control' })).toBeVisible();

  const search = sidebar.getByRole('searchbox', { name: 'Search settings...' });
  await search.fill('Worktree');
  await expect(sidebar.getByRole('button', { name: 'Worktree' })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: 'General' })).toHaveCount(0);

  await search.fill('missing setting');
  await expect(sidebar.getByText('No matching settings')).toBeVisible();
  await sidebar.getByRole('button', { name: 'Clear settings search' }).click();
  await expect(sidebar.getByRole('button', { name: 'General' })).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('settings-sidebar.png'),
    fullPage: true,
  });
});
