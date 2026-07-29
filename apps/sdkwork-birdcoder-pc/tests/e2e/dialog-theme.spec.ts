import { expect, test, type Page } from '@playwright/test';

type ThemeMode = 'dark' | 'light';

const THEME_TOKENS: Record<ThemeMode, Record<string, string>> = {
  dark: {
    '--sdk-color-border-default': 'rgba(255, 255, 255, 0.14)',
    '--sdk-color-surface-elevated': '#2d2d2d',
    '--sdk-color-surface-field-hover': '#333333',
    '--sdk-color-surface-panel-muted': '#262626',
    '--sdk-color-text-muted': '#8c8c8c',
    '--sdk-color-text-primary': '#ffffff',
    '--sdk-color-text-secondary': '#b8b8b8',
  },
  light: {
    '--sdk-color-border-default': 'rgba(13, 13, 13, 0.10)',
    '--sdk-color-surface-elevated': '#ffffff',
    '--sdk-color-surface-field-hover': '#fafafa',
    '--sdk-color-surface-panel-muted': '#f7f7f8',
    '--sdk-color-text-muted': '#737373',
    '--sdk-color-text-primary': '#0d0d0d',
    '--sdk-color-text-secondary': '#525252',
  },
};

async function applyTheme(page: Page, mode: ThemeMode): Promise<void> {
  await page.evaluate(({ nextMode, tokens }) => {
    const root = document.documentElement;
    root.setAttribute('data-sdk-color-mode', nextMode);
    root.style.colorScheme = nextMode;
    Object.entries(tokens).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });
  }, { nextMode: mode, tokens: THEME_TOKENS[mode] });
}

test('task search dialog follows light and dark theme tokens', async ({ page }, testInfo) => {
  await page.goto('/task-search-harness.html');

  const dialog = page.getByRole('dialog', { name: '搜索任务' });
  const searchInput = dialog.getByRole('combobox', { name: '搜索任务' });
  const activeTask = dialog.getByRole('option').first();
  await expect(dialog).toBeVisible();

  await applyTheme(page, 'light');
  await expect(dialog).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(dialog).toHaveCSS('color', 'rgb(13, 13, 13)');
  await expect(searchInput).toHaveCSS('color', 'rgb(13, 13, 13)');
  await expect(activeTask).toHaveCSS('background-color', 'rgb(247, 247, 248)');
  await expect(activeTask).toHaveCSS('color', 'rgb(13, 13, 13)');
  await page.screenshot({
    path: testInfo.outputPath('task-search-dialog-light.png'),
    fullPage: true,
  });

  await applyTheme(page, 'dark');
  await expect(dialog).toHaveCSS('background-color', 'rgb(41, 41, 44)');
  await expect(searchInput).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(activeTask).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect.poll(async () => activeTask.evaluate((element) => (
    getComputedStyle(element).backgroundColor
  ))).not.toBe('rgb(247, 247, 248)');
  await page.screenshot({
    path: testInfo.outputPath('task-search-dialog-dark.png'),
    fullPage: true,
  });
});
