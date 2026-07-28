import { expect, test } from '@playwright/test';

test('Browser Explorer renders and mutates the current project Drive root', async ({ page }) => {
  await page.goto('/#/auth/login');
  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toBeVisible({
    timeout: 45_000,
  });
  await page.getByRole('textbox', { name: 'Account', exact: true })
    .fill('e2e@test.sdkwork.local');
  await page.locator('input[type="password"]').first().fill('e2e-password');
  const sessionResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/app/v3/api/auth/sessions'
  ));
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const sessionResponse = await sessionResponsePromise;
  expect(sessionResponse.ok()).toBe(true);
  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toHaveCount(0, {
    timeout: 45_000,
  });
  await page.goto('/#/app/code');
  await page.getByRole('button', { name: 'Editor Mode', exact: true }).click();

  const projectTree = page.getByRole('tree', { name: 'Project files' });
  await expect(projectTree).toBeVisible({ timeout: 60_000 });
  await expect(projectTree.getByText('sdkwork-birdcoder', { exact: true })).toBeVisible();
  await expect(projectTree.getByText('src', { exact: true })).toBeVisible();
  await expect(projectTree.getByText('README.md', { exact: true })).toBeVisible();

  const sourceDirectory = projectTree.getByRole('treeitem', { name: 'src', exact: true });
  await sourceDirectory.click();
  await expect(sourceDirectory).toHaveAttribute('aria-expanded', 'true');
  await expect(projectTree.getByText('index.ts', { exact: true })).toBeVisible();
  await sourceDirectory.click();
  await expect(sourceDirectory).toHaveAttribute('aria-expanded', 'false');
  await expect(projectTree.getByText('index.ts', { exact: true })).toHaveCount(0);
  await sourceDirectory.click();
  await expect(projectTree.getByText('index.ts', { exact: true })).toBeVisible();

  await sourceDirectory.focus();
  await sourceDirectory.press('ArrowLeft');
  await expect(sourceDirectory).toHaveAttribute('aria-expanded', 'false');
  await expect(projectTree.getByText('index.ts', { exact: true })).toHaveCount(0);
  await sourceDirectory.press('ArrowRight');
  await expect(sourceDirectory).toHaveAttribute('aria-expanded', 'true');
  await expect(projectTree.getByText('index.ts', { exact: true })).toBeVisible();

  await sourceDirectory.press('Shift+F10');
  const sourceActions = page.getByRole('menu', { name: 'Actions for src' });
  await expect(sourceActions).toBeVisible();
  await expect(sourceActions.getByRole('menuitem', { name: 'New File' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(sourceActions).toHaveCount(0);
  await expect(sourceDirectory).toBeFocused();

  await page.getByRole('button', { name: 'Create file', exact: true }).click();
  const newFileInput = projectTree.getByRole('textbox');
  await expect(newFileInput).toBeVisible();
  await newFileInput.fill('browser-root-created.txt');
  await newFileInput.press('Enter');

  await expect(projectTree.getByText('browser-root-created.txt', { exact: true })).toBeVisible();
  await expect(projectTree.getByText('Project is empty', { exact: true })).toHaveCount(0);
});
