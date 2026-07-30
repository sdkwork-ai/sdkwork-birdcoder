import { expect, test } from '@playwright/test';

test('keyboard shortcuts can be searched, customized, reassigned, and used', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
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
  await sidebar.getByRole('button', { name: 'Keyboard Shortcuts' }).click();

  const settingsMain = page.getByRole('main');
  await expect(settingsMain.getByRole('heading', {
    name: 'Keyboard Shortcuts',
    level: 1,
  })).toBeVisible();
  const shortcutSearch = settingsMain.getByRole('searchbox', { name: 'Search shortcuts' });
  await shortcutSearch.fill('terminal');
  await expect(settingsMain.getByText('New terminal', { exact: true })).toBeVisible();
  await expect(settingsMain.getByText('New task', { exact: true })).toHaveCount(0);
  await shortcutSearch.fill('');

  await page.getByRole('button', {
    name: 'Edit Ctrl+/ for Show keyboard shortcuts',
  }).click();
  const shortcutInput = page.getByRole('textbox', {
    name: 'Shortcut for Show keyboard shortcuts',
  });
  const shortcutDialog = page.getByRole('dialog');
  await shortcutInput.press('Control+Alt+K');
  await shortcutDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', {
    name: 'Edit Ctrl+Alt+K for Show keyboard shortcuts',
  })).toBeVisible();

  await page.getByRole('button', {
    name: 'Add a shortcut for Show keyboard shortcuts',
  }).click();
  await shortcutInput.press('Control+Alt+L');
  await shortcutDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', {
    name: 'Remove Ctrl+Alt+L from Show keyboard shortcuts',
  })).toBeVisible();
  await page.getByRole('button', {
    name: 'Remove Ctrl+Alt+L from Show keyboard shortcuts',
  }).click();
  await expect(page.getByRole('button', {
    name: 'Remove Ctrl+Alt+L from Show keyboard shortcuts',
  })).toHaveCount(0);

  await page.screenshot({
    path: testInfo.outputPath('keyboard-shortcuts-settings.png'),
    fullPage: true,
  });

  await sidebar.getByRole('button', { name: 'General' }).click();
  await expect(page.getByRole('heading', { name: 'General', level: 1 })).toBeVisible();
  await page.keyboard.press('Control+Alt+K');
  await expect(page.getByRole('heading', { name: 'Keyboard Shortcuts', level: 1 })).toBeVisible();

  await page.getByRole('button', {
    name: 'Edit Ctrl+Alt+K for Show keyboard shortcuts',
  }).click();
  await shortcutInput.press('Control+,');
  await expect(page.getByText(
    'Ctrl+, is assigned to Settings. Saving will reassign it.',
    { exact: true },
  )).toBeVisible();
  await page.getByRole('button', { name: 'Reassign' }).click();
  await expect(page.getByText('Unassigned', { exact: true })).toBeVisible();

  await page.getByRole('button', {
    name: 'Clear all shortcuts for Show keyboard shortcuts',
  }).click();
  await page.getByRole('button', {
    name: 'Restore default shortcuts for Show keyboard shortcuts',
  }).click();
  await page.getByRole('button', {
    name: 'Restore default shortcuts for Settings',
  }).click();
  await expect(page.getByRole('button', {
    name: 'Edit Ctrl+/ for Show keyboard shortcuts',
  })).toBeVisible();
  await expect(page.getByRole('button', {
    name: 'Edit Ctrl+, for Settings',
  })).toBeVisible();
});
