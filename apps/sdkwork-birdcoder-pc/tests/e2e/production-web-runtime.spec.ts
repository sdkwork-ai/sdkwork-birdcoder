import { expect, test, type Page, type Response } from '@playwright/test';

const IAM_SESSION_PATH = '/app/v3/api/auth/sessions';

function isPasswordSessionResponse(response: Response): boolean {
  return response.request().method() === 'POST'
    && new URL(response.url()).pathname === IAM_SESSION_PATH;
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

test('production bundle authenticates and renders lazy transcript content without runtime errors', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const failedScripts: string[] = [];
  const loadedScripts: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  page.on('requestfailed', (request) => {
    if (request.resourceType() === 'script') {
      failedScripts.push(`${request.url()} ${request.failure()?.errorText ?? 'request failed'}`);
    }
  });
  page.on('response', (response) => {
    if (response.request().resourceType() !== 'script') {
      return;
    }
    loadedScripts.push(response.url());
    if (!response.ok()) {
      failedScripts.push(`${response.url()} HTTP ${response.status()}`);
    }
  });

  await page.goto('/#/auth/login');
  try {
    await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toBeVisible({
      timeout: 45_000,
    });
  } catch (error) {
    throw new Error([
      error instanceof Error ? error.message : String(error),
      `Page errors: ${JSON.stringify(pageErrors)}`,
      `Console errors: ${JSON.stringify(consoleErrors)}`,
      `Failed scripts: ${JSON.stringify(failedScripts)}`,
    ].join('\n'));
  }
  await page.getByRole('textbox', { name: 'Account' }).fill('e2e@test.sdkwork.local');
  await page.locator('input[type="password"]').first().fill('e2e-password');
  const sessionResponsePromise = page.waitForResponse(isPasswordSessionResponse);
  await page.getByRole('button', { name: 'Sign in' }).click();
  const sessionResponse = await sessionResponsePromise;
  expect(sessionResponse.ok()).toBe(true);

  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  await expandProjectSessions(page);
  const claudeSession = page.locator('.birdcoder-session-list .birdcoder-session-row')
    .filter({ hasText: 'Claude architecture review' })
    .first();
  if (!(await claudeSession.getAttribute('class'))?.includes('birdcoder-session-selected')) {
    await claudeSession.click();
  }

  const transcript = page.getByRole('region', { name: 'Conversation messages' });
  await expect(transcript.getByText('Review the message presentation:', { exact: true })).toBeVisible();
  await expect(transcript.locator('[data-chat-markdown-table="true"]')).toContainText('Commands');
  await expect(transcript.locator('pre code').filter({
    hasText: 'const productionRuntimeReady: boolean = true;',
  })).toBeVisible();
  const mermaid = transcript.locator('[data-chat-mermaid="ready"]');
  await expect(mermaid).toBeVisible({ timeout: 30_000 });
  await expect(mermaid.locator('[data-chat-mermaid-svg-host="true"] svg')).toBeVisible();

  for (const dynamicEntry of [
    'UniversalChatMarkdown',
    'UniversalChatCodeBlock',
    'UniversalChatMermaid',
  ]) {
    expect(
      loadedScripts.some((scriptUrl) => new URL(scriptUrl).pathname.includes(dynamicEntry)),
      `Expected the production runtime to load ${dynamicEntry}.`,
    ).toBe(true);
  }
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(failedScripts).toEqual([]);
});
