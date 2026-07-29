import { expect, test } from '@playwright/test';

test('Git settings match the compact Codex workflow and persist preferences', async ({ page }, testInfo) => {
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
  await sidebar.getByRole('button', { name: 'Git' }).click();
  await expect(page.getByRole('heading', { name: 'Git', level: 1 })).toBeVisible();

  const preferences = page.getByRole('region', { name: 'Git settings' });
  const preferencesBox = await preferences.boundingBox();
  if (!preferencesBox) {
    throw new Error('Git preferences must have measurable bounds.');
  }
  expect(preferencesBox.width).toBeLessThanOrEqual(616.5);

  const branchPrefix = page.getByRole('textbox', { name: 'Branch prefix' });
  await expect(branchPrefix).toHaveValue('codex/');
  await expect(page.getByRole('radio', { name: 'Merge' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Squash' })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Always force push' })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Create draft pull requests' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Inline view' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Separate view' })).not.toBeChecked();

  await branchPrefix.fill('birdcoder/');
  await page.getByRole('radio', { name: 'Squash' }).click();
  await page.getByRole('switch', { name: 'Always force push' }).click();
  await page.getByRole('switch', { name: 'Create draft pull requests' }).click();
  await page.getByRole('radio', { name: 'Separate view' }).click();

  const commitInstructions = page.getByRole('region', { name: 'Commit instructions' });
  const commitEditor = commitInstructions.getByRole('textbox');
  const commitSave = commitInstructions.getByRole('button', { name: 'Save' });
  await expect(commitSave).toBeDisabled();
  await commitEditor.fill('Use an imperative subject and include the verification scope.');
  await expect(commitSave).toBeEnabled();
  await commitSave.click();
  await expect(commitSave).toBeDisabled();

  const pullRequestInstructions = page.getByRole('region', {
    name: 'Pull request instructions',
  });
  const pullRequestEditor = pullRequestInstructions.getByRole('textbox');
  const pullRequestSave = pullRequestInstructions.getByRole('button', { name: 'Save' });
  await pullRequestEditor.fill('Summarize user-visible behavior and exact checks.');
  await pullRequestSave.click();
  await expect(pullRequestSave).toBeDisabled();

  await sidebar.getByRole('button', { name: 'Worktree' }).click();
  await sidebar.getByRole('button', { name: 'Git' }).click();
  await expect(branchPrefix).toHaveValue('birdcoder/');
  await expect(page.getByRole('radio', { name: 'Squash' })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Always force push' })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Create draft pull requests' })).not.toBeChecked();
  await expect(page.getByRole('radio', { name: 'Separate view' })).toBeChecked();
  await expect(commitEditor).toHaveValue(
    'Use an imperative subject and include the verification scope.',
  );
  await expect(pullRequestEditor).toHaveValue(
    'Summarize user-visible behavior and exact checks.',
  );

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath('git-settings-desktop.png'),
  });

  await page.setViewportSize({ width: 1120, height: 900 });
  const settingsMain = page.getByRole('main');
  await expect.poll(() => settingsMain.evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath('git-settings-compact.png'),
  });
});
