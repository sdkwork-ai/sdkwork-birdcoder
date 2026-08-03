import { expect, test, type Page } from '@playwright/test';

const THEME_TOKENS: Record<string, Record<string, string>> = {
  dark: {
    '--sdk-color-border-default': 'rgba(255, 255, 255, 0.14)',
    '--sdk-color-surface-canvas': '#181818',
    '--sdk-color-surface-elevated': '#2d2d2d',
    '--sdk-color-surface-field': '#2d2d2d',
    '--sdk-color-surface-field-hover': '#333333',
    '--sdk-color-surface-panel': '#222222',
    '--sdk-color-surface-panel-muted': '#262626',
    '--sdk-color-text-muted': '#8c8c8c',
    '--sdk-color-text-primary': '#ffffff',
    '--sdk-color-text-secondary': '#b8b8b8',
  },
  light: {
    '--sdk-color-border-default': 'rgba(13, 13, 13, 0.10)',
    '--sdk-color-surface-canvas': '#ffffff',
    '--sdk-color-surface-elevated': '#ffffff',
    '--sdk-color-surface-field': '#ffffff',
    '--sdk-color-surface-field-hover': '#fafafa',
    '--sdk-color-surface-panel': '#ffffff',
    '--sdk-color-surface-panel-muted': '#f7f7f8',
    '--sdk-color-text-muted': '#737373',
    '--sdk-color-text-primary': '#0d0d0d',
    '--sdk-color-text-secondary': '#525252',
  },
};

async function applyTheme(page: Page, mode: 'dark' | 'light'): Promise<void> {
  await page.evaluate(({ nextMode, tokens }) => {
    const root = document.documentElement;
    root.setAttribute('data-sdk-color-mode', nextMode);
    root.style.colorScheme = nextMode;
    Object.entries(tokens).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });
  }, { nextMode: mode, tokens: THEME_TOKENS[mode] });
  await page.waitForTimeout(400);
}

test('settings field text and placeholder follow theme tokens', async ({ page }) => {
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

  const commitInstructions = page.getByRole('region', { name: 'Commit instructions' });
  const commitEditor = commitInstructions.getByRole('textbox');
  await expect(commitEditor).toBeVisible();
  const sectionTitle = commitInstructions.locator('h2');
  const description = commitInstructions.locator('p').first();

  await applyTheme(page, 'light');
  await expect(commitEditor).toHaveCSS('color', 'rgb(13, 13, 13)');
  await expect(commitEditor).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(sectionTitle).toHaveCSS('color', 'rgb(13, 13, 13)');
  await expect(description).toHaveCSS('color', 'rgb(115, 115, 115)');

  await applyTheme(page, 'dark');
  await expect(commitEditor).not.toHaveCSS('color', 'rgb(13, 13, 13)');
});
