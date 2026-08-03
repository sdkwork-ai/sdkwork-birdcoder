import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

type ThemeMode = 'dark' | 'light';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;

/**
 * Mirrors the host theme tokens applied by the runtime ThemeManager so tests
 * can flip the shell between light and dark without opening settings.
 */
const THEME_TOKENS: Record<ThemeMode, Record<string, string>> = {
  dark: {
    '--birdcoder-chrome-surface': '#1e2024',
    '--sdk-color-border-default': 'rgba(255, 255, 255, 0.14)',
    '--sdk-color-surface-canvas': '#181818',
    '--sdk-color-surface-elevated': '#2d2d2d',
    '--sdk-color-surface-field-hover': '#333333',
    '--sdk-color-surface-panel': '#222222',
    '--sdk-color-surface-panel-muted': '#262626',
    '--sdk-color-text-muted': '#8c8c8c',
    '--sdk-color-text-primary': '#ffffff',
    '--sdk-color-text-secondary': '#b8b8b8',
  },
  light: {
    '--birdcoder-chrome-surface': '#f0f3f9',
    '--sdk-color-border-default': 'rgba(13, 13, 13, 0.10)',
    '--sdk-color-surface-canvas': '#ffffff',
    '--sdk-color-surface-elevated': '#ffffff',
    '--sdk-color-surface-field-hover': '#fafafa',
    '--sdk-color-surface-panel': '#ffffff',
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
  // The composer surface animates background-color over 200ms; wait for the
  // transition to settle before asserting computed colors.
  await page.waitForTimeout(400);
}

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

async function expandProjectSessions(page: Page): Promise<void> {
  const sessionList = page.locator('.birdcoder-session-list');
  const claudeSession = sessionList
    .getByText('Claude architecture review', { exact: true })
    .first();
  const expandProject = page.getByRole('button', { name: 'Expand E2E Project' });
  const showMoreSessions = sessionList.getByRole('button', { name: 'Show more' }).first();
  await expect.poll(async () => (
    await claudeSession.count() > 0
    || await expandProject.count() > 0
    || await showMoreSessions.count() > 0
  ), { timeout: 60_000 }).toBe(true);
  if (await claudeSession.count() === 0 && await expandProject.isVisible()) {
    await expandProject.click();
  }
  if (await claudeSession.count() === 0 && await showMoreSessions.isVisible()) {
    await showMoreSessions.click();
  }
  await expect(claudeSession).toBeVisible();
}

async function selectClaudeSession(page: Page): Promise<void> {
  const sessionRow = page.locator('.birdcoder-session-list .birdcoder-session-row')
    .filter({ hasText: 'Claude architecture review' })
    .first();
  await expect(sessionRow).toBeVisible();
  const className = await sessionRow.getAttribute('class');
  if (!className?.includes('birdcoder-session-selected')) {
    await sessionRow.click();
  }
}

test('chat dialog background and message bodies follow light and dark theme tokens', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });

  await expandProjectSessions(page);
  await selectClaudeSession(page);

  const chatRoot = page.locator('[data-universal-chat-root="true"]').first();
  await expect(chatRoot).toBeVisible();
  const transcript = page.getByRole('region', { name: 'Conversation messages' });
  const messageBody = transcript.locator('.prose-invert p').first();
  await expect(messageBody).toBeVisible();
  const sessionList = page.locator('.birdcoder-session-list');
  const composerSurface = page.locator('.composer-surface-chrome').first();
  await expect(composerSurface).toBeVisible();

  await applyTheme(page, 'light');
  await expect(chatRoot).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(messageBody).toHaveCSS('color', 'rgb(13, 13, 13)');
  await expect(composerSurface).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(sessionList).toHaveCSS('background-color', 'rgb(240, 243, 249)');
  await expect(sessionList.locator('.birdcoder-session-row').first()).not.toHaveCSS(
    'color',
    'rgb(255, 255, 255)',
  );

  await applyTheme(page, 'dark');
  await expect(chatRoot).toHaveCSS('background-color', 'rgb(24, 24, 24)');
  await expect(messageBody).not.toHaveCSS('color', 'rgb(13, 13, 13)');
  await expect(composerSurface).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(sessionList).toHaveCSS('background-color', 'rgb(30, 32, 36)');
});

test('session switcher dialog follows light and dark theme tokens', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });

  await expandProjectSessions(page);
  await selectClaudeSession(page);

  await page.getByRole('button', { name: 'Studio' }).click();

  const sessionPicker = page.locator('[data-studio-chat-header="true"] button').filter({
    hasText: '/',
  }).first();
  await expect(sessionPicker).toBeVisible({ timeout: 60_000 });
  await sessionPicker.click();
  const sessionMenu = page.locator('[data-studio-session-menu="true"]');
  await expect(sessionMenu).toBeVisible();

  await applyTheme(page, 'light');
  await expect(sessionMenu).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(sessionMenu.locator('[data-studio-projects-pane="true"]')).toHaveCSS(
    'background-color',
    'rgb(247, 247, 248)',
  );

  await applyTheme(page, 'dark');
  await expect(sessionMenu).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(sessionMenu.locator('[data-studio-projects-pane="true"]')).toHaveCSS(
    'background-color',
    'rgb(21, 22, 26)',
  );
});

test('model access selector trigger and menu follow light and dark theme tokens', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });

  await expandProjectSessions(page);
  await selectClaudeSession(page);

  const trigger = page.locator('.sdkwork-model-access-trigger').first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  const menu = page.locator('.sdkwork-model-access-menu');
  await expect(menu).toBeVisible();

  await applyTheme(page, 'light');
  await expect(trigger).toHaveCSS('color', 'rgb(82, 82, 82)');
  await expect(menu).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(menu).toHaveCSS('color', 'rgb(13, 13, 13)');
  await expect(menu.locator('.sdkwork-model-access-section-title').first()).toHaveCSS(
    'color',
    'rgb(115, 115, 115)',
  );

  await applyTheme(page, 'dark');
  await expect(trigger).not.toHaveCSS('color', 'rgb(82, 82, 82)');
  await expect(menu).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
});
