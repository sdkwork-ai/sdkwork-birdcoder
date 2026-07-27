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

async function ensureProjectSessionsExpanded(page: Page): Promise<void> {
  const expandProject = page.getByRole('button', { name: 'Expand E2E Project' });
  const collapseProject = page.getByRole('button', { name: 'Collapse E2E Project' });
  await expect.poll(async () => (
    await collapseProject.count() > 0 || await expandProject.count() > 0
  ), { timeout: 60_000 }).toBe(true);
  if (await expandProject.count() > 0) {
    await expect(expandProject).toBeVisible();
    await expandProject.click();
  }
  await expect(collapseProject).toBeVisible();
}

async function openOrganizeMenu(page: Page) {
  const button = page.getByTitle('Organize');
  await expect(button).toHaveCount(1);
  await button.click();
  const menu = page.locator('.birdcoder-chrome-menu');
  await expect(menu).toBeVisible();
  return menu;
}

test('multi-provider Session Inbox preserves identity while grouping, filtering, and sorting', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.goto('/#/app/code');

  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  await ensureProjectSessionsExpanded(page);

  const sessionList = page.locator('.birdcoder-session-list');
  const sessionRows = page.locator('.birdcoder-session-list .birdcoder-session-row:visible');
  await expect(sessionList.getByText('Claude architecture review', { exact: true })).toBeVisible();
  await expect(sessionList.getByText('Codex implementation', { exact: true })).toBeVisible();
  await expect(sessionList.getByText('OpenCode verification', { exact: true })).toBeVisible();
  const smartOrderDetails = await sessionRows.evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('title')),
  );
  const uniqueSmartOrderDetails = smartOrderDetails.filter((details, index, allDetails) => {
    if (!details) {
      return false;
    }
    const title = details?.split(' | ')[0];
    return allDetails.findIndex((candidate) => candidate?.split(' | ')[0] === title) === index;
  });
  expect(uniqueSmartOrderDetails.slice(0, 3).map((details) => details?.split(' | ')[0])).toEqual([
    'Claude architecture review',
    'Codex implementation',
    'OpenCode verification',
  ]);
  expect(uniqueSmartOrderDetails.slice(0, 3)).toEqual([
    expect.stringContaining('anthropic'),
    expect.stringContaining('openai'),
    expect.stringContaining('opencode'),
  ]);

  let menu = await openOrganizeMenu(page);
  await expect(menu.getByRole('button', { name: 'Smart Priority', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Recent Activity', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Created', exact: true })).toBeVisible();
  await menu.getByRole('button', { name: 'By Provider', exact: true }).click();

  await expect(sessionList.getByText('Claude architecture review', { exact: true })).toBeVisible();
  await expect(sessionList.getByText('Codex implementation', { exact: true })).toBeVisible();
  await expect(sessionList.getByText('OpenCode verification', { exact: true })).toBeVisible();

  const providerContinuation = sessionList.getByRole('button', {
    name: /E2E Project.*Show more/iu,
  });
  await expect(providerContinuation).toBeVisible();
  await providerContinuation.click();
  await expect(providerContinuation).toBeVisible();
  await providerContinuation.click();
  await expect(sessionList.getByText('History page two session', { exact: true })).toBeVisible();

  menu = await openOrganizeMenu(page);
  await menu.getByRole('button', { name: 'Chronological', exact: true }).click();
  const chronologicalContinuation = sessionList.getByRole('button', {
    name: /E2E Project.*Show more/iu,
  });
  await expect(chronologicalContinuation).toBeVisible();
  await chronologicalContinuation.click();
  await expect(chronologicalContinuation).toBeVisible();
  await chronologicalContinuation.click();
  await expect(sessionList.getByText('History page three session', { exact: true })).toBeVisible();

  menu = await openOrganizeMenu(page);
  await menu.getByRole('button', { name: 'By Provider', exact: true }).click();

  menu = await openOrganizeMenu(page);
  const codexProvider = menu.getByRole('button', { name: 'Codex', exact: true });
  await expect(codexProvider).toHaveCount(1);
  await codexProvider.click();
  await expect(sessionList.getByText('Codex implementation', { exact: true })).toBeVisible();
  await expect(sessionList.getByText('Claude architecture review', { exact: true })).toHaveCount(0);
  await expect(sessionList.getByText('OpenCode verification', { exact: true })).toHaveCount(0);

  menu = await openOrganizeMenu(page);
  await menu.getByRole('button', { name: 'Any Provider', exact: true }).click();
  await expect(sessionList.getByText('Claude architecture review', { exact: true })).toBeVisible();
  await expect(sessionList.getByText('Codex implementation', { exact: true })).toBeVisible();
  await expect(sessionList.getByText('OpenCode verification', { exact: true })).toBeVisible();

  await sessionList.getByText('Codex implementation', { exact: true }).click();
  const selectedRow = page.locator(
    '.birdcoder-session-list .birdcoder-session-row.birdcoder-session-selected:visible',
  );
  await expect(selectedRow).toHaveAttribute('title', /Codex implementation/u);

  const transcript = page.getByRole('region', { name: 'Conversation messages' });
  const loadEarlierMessages = transcript.getByRole('button', {
    name: 'Load earlier messages',
    exact: true,
  });
  await expect(transcript.getByText('Codex historical message 26', { exact: true })).toBeVisible();
  await expect(loadEarlierMessages).toBeVisible();
  const secondItemPageResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/e2e-codex-session/items')
      && url.searchParams.get('page') === '2'
      && url.searchParams.get('page_size') === '20';
  });
  await loadEarlierMessages.click();
  await secondItemPageResponse;
  await expect(transcript.getByText('Codex historical message 6', { exact: true })).toBeVisible();
  await expect(loadEarlierMessages).toBeVisible();
  const thirdItemPageResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/e2e-codex-session/items')
      && url.searchParams.get('page') === '3'
      && url.searchParams.get('page_size') === '20';
  });
  await loadEarlierMessages.click();
  await thirdItemPageResponse;
  await expect(transcript.getByText('Codex historical message 1', { exact: true })).toBeVisible();
  await expect(loadEarlierMessages).toHaveCount(0);

  menu = await openOrganizeMenu(page);
  await menu.getByRole('button', { name: 'Created', exact: true }).click();
  await expect(selectedRow).toHaveAttribute('title', /Codex implementation/u);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(sessionList.getByText('Claude architecture review', { exact: true })).toBeVisible();
  await expect(sessionList.getByText('Codex implementation', { exact: true })).toBeVisible();
  await expect(sessionList.getByText('OpenCode verification', { exact: true })).toBeVisible();

  menu = await openOrganizeMenu(page);
  await expect(menu.getByRole('button', { name: 'Created', exact: true }).locator('svg'))
    .toHaveCount(1);
  await expect(menu.getByRole('button', { name: 'By Provider', exact: true }).locator('svg'))
    .toHaveCount(1);
});
