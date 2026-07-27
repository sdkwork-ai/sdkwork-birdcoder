import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;

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
  const codexSession = page.getByText('Codex implementation', { exact: true });
  const expandProject = page.getByRole('button', { name: 'Expand E2E Project' });
  await expect.poll(async () => (
    await codexSession.count() > 0 || await expandProject.count() > 0
  ), { timeout: 60_000 }).toBe(true);
  if (await codexSession.count() === 0) {
    await expandProject.click();
  }
  await expect(codexSession).toBeVisible();
}

test('Session transcript survives rapid reselection and completes a sent turn', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  await page.setViewportSize({ width: 1_440, height: 900 });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  let codexItemRequestCount = 0;

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route(/\/e2e-codex-session\/items(?:\?.*)?$/u, async (route) => {
    codexItemRequestCount += 1;
    if (codexItemRequestCount === 1) {
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
    await route.continue();
  });

  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  await expandProjectSessions(page);

  const codexSession = page.getByText('Codex implementation', { exact: true });
  const openCodeSession = page.getByText('OpenCode verification', { exact: true });
  await codexSession.click();
  await expect.poll(() => codexItemRequestCount).toBe(1);
  await openCodeSession.click();
  await codexSession.click();

  const transcript = page.getByRole('region', { name: 'Conversation messages' });
  await expect.poll(() => codexItemRequestCount).toBeGreaterThanOrEqual(2);
  await expect(transcript.getByText('Codex historical message 45', { exact: true })).toBeVisible();

  const loadEarlierMessages = transcript.getByRole('button', {
    name: 'Load earlier messages',
    exact: true,
  });
  await expect(loadEarlierMessages).toBeVisible();
  await loadEarlierMessages.click();
  await expect(transcript.getByText('Codex historical message 6', { exact: true })).toBeVisible();
  await loadEarlierMessages.click();
  await expect(transcript.getByText('Codex historical message 1', { exact: true })).toBeVisible();
  await expect(loadEarlierMessages).toHaveCount(0);

  const message = `E2E session send verification ${Date.now()}`;
  const composer = page.locator(
    'textarea[placeholder="Ask anything or request changes..."]:visible',
  );
  await expect(composer).toHaveCount(1);
  await composer.fill(message);
  const turnResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'POST'
      && url.pathname.endsWith('/e2e-codex-session/turns');
  });
  await page.locator('button[title="Send message"]:visible').click();
  expect((await turnResponse).ok()).toBe(true);

  await expect(transcript.getByText(message, { exact: true })).toBeVisible();
  await expect(transcript.getByText(`Mock assistant response to: ${message}`, {
    exact: true,
  })).toBeVisible();
  await expect(composer).toHaveValue('');
  await expect(page.getByText(/Cannot read properties of undefined/iu)).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter((entry) => (
    /session items|transcript|send message|undefined.*map/iu.test(entry)
  ))).toEqual([]);
});
