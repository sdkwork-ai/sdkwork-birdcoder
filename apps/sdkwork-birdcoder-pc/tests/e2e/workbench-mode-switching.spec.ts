import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;
const workbenchPreferencesKey =
  'sdkwork-birdcoder.ui.v1:workbench-settings:preferences.v1';

async function bootstrapAuthenticatedSession(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  const response = await request.post(`${mockApiBaseUrl}/app/v3/api/auth/sessions`, {
    data: {
      account: 'e2e@test.sdkwork.local',
      password: 'e2e-password',
    },
  });
  expect(response.ok()).toBe(true);
  const payload = await response.json() as {
    data: {
      expiresAt: string;
      [key: string]: unknown;
    };
  };
  await page.addInitScript((session) => {
    localStorage.setItem('sdkwork.birdcoder.appSession.v1', JSON.stringify({
      ...session,
      expiresAt: Math.floor(Date.parse(session.expiresAt) / 1_000),
      storedAt: Math.floor(Date.now() / 1_000),
    }));
  }, payload.data);
}

async function readProviderIds(page: Page): Promise<string[]> {
  const trigger = page.locator('[data-sidebar-new-session-trigger="true"]');
  await trigger.hover();
  const menu = page.locator('[data-sidebar-new-session-menu="true"]');
  await expect(menu).toBeVisible();
  return menu.locator('[role="menuitemradio"] [data-provider-id]').evaluateAll(
    (elements) => elements.map((element) => element.getAttribute('data-provider-id') ?? ''),
  );
}

test('Birdcoder switches between constrained Coding and Work modes', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/app/code');

  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  const header = page.locator('[data-sidebar-brand-header="true"]');
  const modeTrigger = header.locator('[data-sidebar-mode-trigger="true"]');
  const searchTrigger = header.locator('[data-sidebar-search-trigger="true"]');
  await expect(header).toHaveAttribute('data-workbench-mode', 'coding');
  await expect(modeTrigger).toContainText('Birdcoder');

  const codingHeaderBox = await header.boundingBox();
  const controlMetrics = await header.evaluate((element) => {
    const mode = element.querySelector<HTMLElement>('[data-sidebar-mode-trigger="true"]');
    const search = element.querySelector<HTMLElement>('[data-sidebar-search-trigger="true"]');
    const searchIcon = search?.querySelector<SVGElement>('.lucide-search');
    if (!mode || !search || !searchIcon) {
      throw new Error('Sidebar mode and search controls must be rendered.');
    }
    return {
      brandFontSize: window.getComputedStyle(mode).fontSize,
      modeHeight: mode.getBoundingClientRect().height,
      searchHeight: search.getBoundingClientRect().height,
      searchIconWidth: searchIcon.getBoundingClientRect().width,
      searchWidth: search.getBoundingClientRect().width,
    };
  });
  expect(controlMetrics).toEqual({
    brandFontSize: '15px',
    modeHeight: 28,
    searchHeight: 28,
    searchIconWidth: 16,
    searchWidth: 28,
  });

  expect(await readProviderIds(page)).toEqual([
    'claude-code',
    'codex',
    'opencode',
    'gemini',
  ]);

  await modeTrigger.click();
  const modeMenu = page.locator('[data-sidebar-mode-menu="true"]');
  await expect(modeMenu).toBeVisible();
  await modeMenu.locator('[data-sidebar-mode-option="work"]').click();

  await expect(header).toHaveAttribute('data-workbench-mode', 'work');
  await expect(page.locator('[data-work-sidebar="true"]')).toBeVisible();
  const workHeaderBox = await header.boundingBox();
  expect(workHeaderBox).toEqual(codingHeaderBox);

  await expect(page.getByText('OpenClaw operations plan', { exact: true })).toBeVisible();
  await expect(page.getByText('Hermes research brief', { exact: true })).toBeVisible();
  await expect(page.getByText('Codex implementation', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Claude architecture review', { exact: true })).toHaveCount(0);
  expect(await readProviderIds(page)).toEqual(['openclaw', 'hermes']);

  await expect.poll(() => page.evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as { workbenchMode?: unknown }).workbenchMode : null;
  }, workbenchPreferencesKey)).toBe('work');

  await page.reload();
  await expect(page.locator('[data-sidebar-brand-header="true"]')).toHaveAttribute(
    'data-workbench-mode',
    'work',
    { timeout: 60_000 },
  );
  await expect(page.locator('[data-work-sidebar="true"]')).toBeVisible();

  await page.locator('[data-work-navigation-item="expert-tools"]').click();
  await expect(page.getByRole('heading', { name: 'Plugins', level: 1 })).toBeVisible();
});
