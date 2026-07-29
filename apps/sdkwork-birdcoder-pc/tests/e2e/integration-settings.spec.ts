import { expect, test } from '@playwright/test';

test('browser and computer control settings persist real configuration state', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/auth/login');

  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toBeVisible({ timeout: 45_000 });
  await page.getByRole('textbox', { name: 'Account' }).fill('e2e@test.sdkwork.local');
  await page.locator('input[type="password"]').first().fill('e2e-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  const settingsTab = page.getByTitle('Settings').first();
  await expect(settingsTab).toBeVisible({ timeout: 60_000 });
  await settingsTab.click();

  const sidebar = page.getByRole('complementary', { name: 'Settings navigation' });
  await sidebar.getByRole('button', { name: 'Browser' }).click();
  await expect(page.getByRole('heading', { name: 'Browser', level: 1 })).toBeVisible();

  const browserSwitch = page.getByRole('switch', { name: 'Browser' });
  await expect(browserSwitch).toBeChecked();
  await browserSwitch.click();
  await expect(browserSwitch).not.toBeChecked();
  await browserSwitch.click();
  await page.getByRole('combobox', { name: 'Open web URL links with' }).selectOption('birdcoder');

  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('textbox', { name: 'Website address' }).fill('https://example.com/path');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('https://example.com', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Computer Control settings' }).click();
  await expect(page.getByRole('heading', { name: 'Computer Control', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Install Any app' }).click();
  await expect(page.getByText('Desktop app required')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Any app' })).toBeVisible();

  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('textbox', { name: 'Application name' }).fill('Visual Studio Code');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Visual Studio Code', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Install Google Chrome' }).click();
  await expect(page.getByText('Browser extension not connected')).toBeVisible();

  await sidebar.getByRole('button', { name: 'Browser' }).click();
  await expect(page.getByRole('combobox', { name: 'Open web URL links with' })).toHaveValue('birdcoder');
  await expect(page.getByText('https://example.com', { exact: true })).toBeVisible();

  const content = page.getByRole('main').locator('> div');
  const contentBox = await content.boundingBox();
  if (!contentBox) {
    throw new Error('Browser settings content must have measurable bounds.');
  }
  expect(contentBox.width).toBeLessThanOrEqual(616.5);

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath('browser-settings-desktop.png'),
  });

  await page.setViewportSize({ width: 1120, height: 900 });
  const settingsMain = page.getByRole('main');
  await expect.poll(() => settingsMain.evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  await sidebar.getByRole('button', { name: 'Computer Control' }).click();
  await expect(sidebar.getByRole('button', { name: 'Computer Control' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect.poll(() => settingsMain.evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  await page.mouse.move(1100, 850);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath('computer-control-settings-compact.png'),
  });
});
