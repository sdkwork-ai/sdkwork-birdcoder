import { expect, test } from '@playwright/test';

test('boot shell renders the BirdCoder startup surface', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/SDKWork BirdCoder/u);
  await expect(page.getByText('Starting SDKWork BirdCoder')).toBeVisible();
});
