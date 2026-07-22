import { expect, test } from '@playwright/test';

test('boot shell renders the BirdCoder startup surface', async ({ page }) => {
  await page.route('**/readyz', async (route) => {
    await new Promise((resolve) => globalThis.setTimeout(resolve, 1_500));
    await route.continue();
  });

  await page.goto('/');

  await expect(page).toHaveTitle(/SDKWork BirdCoder/u);
  await expect(page.getByRole('heading', { name: 'SDKWork BirdCoder', exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '36');
  const bootShell = page.locator('[data-birdcoder-boot-shell]');
  await expect(bootShell).toHaveCount(1);
  await expect(page.locator('.sdkwork-startup-progress-meta')).toBeVisible();

  const decorationContent = await bootShell.evaluate((element) => ({
    after: window.getComputedStyle(element, '::after').content,
    before: window.getComputedStyle(element, '::before').content,
  }));
  expect(decorationContent).toEqual({ after: 'none', before: 'none' });

  const shellBorders = await page.locator('.sdkwork-startup-shell').evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      left: styles.borderLeftWidth,
      right: styles.borderRightWidth,
    };
  });
  expect(shellBorders).toEqual({ left: '0px', right: '0px' });

  const brandMarkPosition = await page.locator('.sdkwork-startup-mark').evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      height: bounds.height,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
    };
  });
  expect(brandMarkPosition.height).toBe(30);
  expect(brandMarkPosition.left).toBeLessThanOrEqual(32);
  expect(brandMarkPosition.top).toBeLessThanOrEqual(32);
  expect(brandMarkPosition.width).toBe(30);
});

test('boot shell presents an actionable runtime failure state', async ({ page }) => {
  await page.route('**/readyz', async (route) => {
    await route.abort('failed');
  });

  await page.goto('/');

  const bootShell = page.locator('[data-birdcoder-boot-shell]');
  await expect(bootShell).toHaveClass(/is-failed/u);
  await expect(bootShell).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.sdkwork-startup-retry')).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuetext', /36%/u);
});
