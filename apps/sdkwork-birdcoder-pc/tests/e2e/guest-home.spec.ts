import { expect, test } from '@playwright/test';

test('guest home renders the templates catalog surface', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Project Templates')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('E2E Starter')).toBeVisible();
});
