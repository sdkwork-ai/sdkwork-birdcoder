import { expect, test, type Page } from '@playwright/test';

function createPageEnvelope(items: unknown[]) {
  return {
    code: 0,
    data: {
      items,
      pageInfo: {
        hasMore: false,
        mode: 'offset',
        page: 1,
        pageSize: 50,
        totalItems: String(items.length),
        totalPages: items.length > 0 ? 1 : 0,
      },
    },
    traceId: 'plugin-settings-e2e',
  };
}

async function mockRemoteCapabilityCatalog(page: Page) {
  await page.route('**/app/v3/api/ai/mcp_servers**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: createPageEnvelope([{
        agentId: 'agent.intelligence.claude-code',
        enabled: true,
        priority: 1,
        serverId: 'filesystem',
        slotId: 'mcp-filesystem',
        targetModule: 'mcp',
        targetRef: 'mcp/filesystem',
      }]),
    });
  });
  await page.route('**/app/v3/api/ai/agents/*/composition_slots**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: createPageEnvelope([{
        agentId: 'agent.claude-code',
        createdAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
        enabled: true,
        id: '1',
        organizationId: '0',
        policyJson: '{}',
        priority: 1,
        slotId: 'skill-code-review',
        slotKind: 'skill',
        status: 'active',
        targetModule: 'skills',
        targetRef: 'code-review',
        tenantId: '0',
        updatedAt: '2026-01-01T00:00:00.000Z',
        version: '1',
      }]),
    });
  });
  await page.route('**/app/v3/api/skill_packages**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: createPageEnvelope([{
        categories: ['development'],
        code: 'code-review',
        createdAt: '2026-01-01T00:00:00.000Z',
        description: 'Review changes for correctness and regressions',
        displayName: 'Code Review',
        featured: true,
        id: 'skill-package-code-review',
        organizationId: '0',
        ownerUserId: '1',
        packageKey: 'code-review',
        skillKey: 'code-review',
        sortWeight: 1,
        status: 'active',
        summary: 'Review changes for correctness and regressions',
        tags: ['review'],
        tenantId: '0',
        updatedAt: '2026-01-01T00:00:00.000Z',
        uuid: 'skill-package-code-review-uuid',
        version: '1',
        visibility: 'public',
      }]),
    });
  });
}

test('plugin settings expose real catalog categories and persist capability toggles', async ({ page }, testInfo) => {
  await mockRemoteCapabilityCatalog(page);
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
  await sidebar.getByRole('button', { name: 'Plugins' }).click();
  await expect(page.getByRole('heading', { name: 'Plugins', level: 1 })).toBeVisible();

  const catalog = page.getByRole('region', { name: 'Plugins, MCP, and skills' });
  const catalogBox = await catalog.boundingBox();
  if (!catalogBox) {
    throw new Error('Plugin settings catalog must have measurable bounds.');
  }
  expect(catalogBox.width).toBeLessThanOrEqual(616.5);

  await expect(catalog.getByRole('tab', { name: 'MCP 1' })).toBeVisible();
  await expect(catalog.getByRole('tab', { name: 'Skills 1' })).toBeVisible();
  await catalog.getByRole('tab', { name: 'MCP 1' }).click();
  const filesystemSwitch = catalog.getByRole('switch', { name: 'Filesystem' });
  await expect(filesystemSwitch).toBeChecked();
  await filesystemSwitch.click();
  await expect(filesystemSwitch).not.toBeChecked();

  await catalog.getByRole('tab', { name: 'Skills 1' }).click();
  await expect(catalog.getByText('Code Review')).toBeVisible();
  const search = catalog.getByRole('searchbox', { name: 'Search integrations' });
  await search.fill('missing');
  await expect(catalog.getByText('No matching capabilities')).toBeVisible();
  await catalog.getByRole('button', { name: 'Clear search' }).click();
  await expect(catalog.getByText('Code Review')).toBeVisible();

  await sidebar.getByRole('button', { name: 'Git' }).click();
  await sidebar.getByRole('button', { name: 'Plugins' }).click();
  await catalog.getByRole('tab', { name: 'MCP 1' }).click();
  await expect(filesystemSwitch).not.toBeChecked();

  await sidebar.getByRole('button', { name: 'Back to App' }).click();
  const addAttachments = page.getByRole('button', { name: 'Add attachment' });
  await expect(addAttachments).toBeVisible();
  await addAttachments.click();
  const composerActions = page.getByTestId('composer-action-panel');
  await expect(composerActions).toBeVisible();
  await expect(
    composerActions.getByRole('menuitem').filter({ hasText: 'Filesystem' }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');

  await page.getByTitle('Settings').first().click();
  await sidebar.getByRole('button', { name: 'Plugins' }).click();
  await catalog.getByRole('tab', { name: 'MCP 1' }).click();
  await expect(filesystemSwitch).not.toBeChecked();

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath('plugin-settings-desktop.png'),
  });

  await page.setViewportSize({ width: 1120, height: 900 });
  const settingsMain = page.getByRole('main');
  await expect.poll(() => settingsMain.evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath('plugin-settings-compact.png'),
  });
});
