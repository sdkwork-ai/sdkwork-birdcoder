import { expect, test } from '@playwright/test';

test('worktree settings match the compact managed workflow', async ({ page }, testInfo) => {
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
  await sidebar.getByRole('button', { name: 'Worktree' }).click();

  await expect(page.getByRole('heading', { name: 'Worktree', level: 1 })).toBeVisible();
  const preferences = page.getByRole('region', { name: 'Worktree settings' });
  await expect(preferences).toContainText('Worktree root directory');
  await expect(preferences.getByTitle('Project-local .sdkwork-worktrees')).toContainText('Default');

  const autoPrune = page.getByRole('switch', {
    name: 'Automatically prune stale references',
  });
  await expect(autoPrune).toBeChecked();

  const assertKnobIsInsideTrack = async () => {
    const trackBox = await autoPrune.boundingBox();
    const knobBox = await autoPrune.locator('span').boundingBox();
    if (!trackBox || !knobBox) {
      throw new Error('The worktree auto-prune switch must have measurable bounds.');
    }
    expect(knobBox.x).toBeGreaterThanOrEqual(trackBox.x);
    expect(knobBox.x + knobBox.width).toBeLessThanOrEqual(trackBox.x + trackBox.width);
    expect(knobBox.y).toBeGreaterThanOrEqual(trackBox.y);
    expect(knobBox.y + knobBox.height).toBeLessThanOrEqual(trackBox.y + trackBox.height);
  };

  await assertKnobIsInsideTrack();
  await autoPrune.click();
  await expect(autoPrune).not.toBeChecked();
  await assertKnobIsInsideTrack();

  await sidebar.getByRole('button', { name: 'General' }).click();
  await sidebar.getByRole('button', { name: 'Worktree' }).click();
  await expect(autoPrune).not.toBeChecked();

  const listLimit = page.getByRole('spinbutton', { name: 'List display limit' });
  await expect(listLimit).toHaveValue('15');
  await listLimit.fill('24');
  await listLimit.blur();
  await expect(listLimit).toHaveValue('24');

  const preferencesBox = await preferences.boundingBox();
  const worktreeRegion = page.getByRole('region', { name: /Worktrees/u });
  const worktreeBox = await worktreeRegion.boundingBox();
  if (!preferencesBox || !worktreeBox) {
    throw new Error('Worktree settings sections must have measurable bounds.');
  }
  expect(preferencesBox.width).toBeLessThanOrEqual(616.5);
  expect(worktreeBox.x).toBeCloseTo(preferencesBox.x, 0);
  expect(worktreeBox.width).toBeCloseTo(preferencesBox.width, 0);
  expect(worktreeBox.y - (preferencesBox.y + preferencesBox.height)).toBeGreaterThanOrEqual(36);

  await expect(page.getByRole('button', { name: 'Create worktree' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Refresh Git overview' })).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('worktree-settings-desktop.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 1120, height: 900 });
  const settingsMain = page.getByRole('main');
  await expect.poll(() => settingsMain.evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('worktree-settings-compact.png'),
    fullPage: true,
  });
});
