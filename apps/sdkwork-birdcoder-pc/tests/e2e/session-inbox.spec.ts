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

async function revealSessionByLoadingMore(
  sessionList: ReturnType<Page['locator']>,
  title: string,
  maxAttempts = 4,
): Promise<number> {
  const target = sessionList.getByText(title, { exact: true });
  let attempts = 0;
  while (!(await target.isVisible()) && attempts < maxAttempts) {
    const continuation = sessionList.getByRole('button', {
      name: /E2E Project.*Show more/iu,
    });
    await expect(continuation).toBeVisible();
    await continuation.click();
    attempts += 1;
  }
  await expect(target).toBeVisible();
  return attempts;
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

  const sessionList = page.locator('.project-explorer-scroll-region').last();
  const sessionRows = sessionList.locator('.birdcoder-session-row:visible');
  await expect(sessionList.getByText('Claude architecture review', { exact: true })).toBeVisible();
  await expect(sessionList.getByText('Codex implementation', { exact: true })).toBeVisible();
  await expect(sessionList.getByText('OpenCode verification', { exact: true })).toBeVisible();
  await expect(sessionList.getByText('Gemini failure triage', { exact: true })).toBeVisible();

  const expectedProviderVisuals = [
    ['e2e-claude-session', 'claude-code', 'CC', 'amber'],
    ['e2e-codex-session', 'codex', 'CX', 'emerald'],
    ['e2e-opencode-session', 'opencode', 'OC', 'rose'],
    ['e2e-gemini-session', 'gemini', 'GM', 'sky'],
  ] as const;
  const providerVisualStyles = new Map<string, {
    backgroundColor: string;
    boxShadow: string;
    color: string;
  }>();
  for (const [sessionId, providerId, abbreviation, tone] of expectedProviderVisuals) {
    const providerBadge = sessionList
      .locator(`[data-agent-session-id="${sessionId}"]`)
      .locator('[data-session-provider-badge="leading"]');
    await expect(providerBadge).toHaveAttribute('data-session-provider-id', providerId);
    await expect(providerBadge).toHaveAttribute(
      'data-session-provider-abbreviation',
      abbreviation,
    );
    await expect(providerBadge).toHaveAttribute('data-session-provider-tone', tone);
    providerVisualStyles.set(providerId, await providerBadge.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow,
        color: style.color,
      };
    }));
  }
  expect(
    new Set(
      [...providerVisualStyles.values()].map(
        (style) => `${style.backgroundColor}|${style.color}|${style.boxShadow}`,
      ),
    ).size,
  ).toBe(expectedProviderVisuals.length);

  const claudeSessionVisualStyle = providerVisualStyles.get('claude-code');
  expect(claudeSessionVisualStyle).toBeDefined();
  const sidebarNewTaskEntry = page.locator('[data-sidebar-new-session-trigger="true"]');
  await expect(sidebarNewTaskEntry).toHaveAccessibleName('New task');
  await expect(sidebarNewTaskEntry.locator('[data-provider-id]')).toHaveCount(0);
  await expect(sidebarNewTaskEntry.locator('.lucide-square-pen')).toHaveCount(1);
  const sharedClaudeProviderIcons = [
    page
      .getByRole('button', { name: 'Current provider: Claude Code', exact: true })
      .locator('[data-provider-id="claude-code"]'),
  ];
  for (const providerIcon of sharedClaudeProviderIcons) {
    await expect(providerIcon).toHaveAttribute('data-provider-abbreviation', 'CC');
    await expect(providerIcon).toHaveAttribute('data-provider-tone', 'amber');
    expect(await providerIcon.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow,
        color: style.color,
      };
    })).toEqual(claudeSessionVisualStyle);
  }

  const expectedRuntimeStates = [
    ['e2e-claude-session', 'streaming', 'busy', true],
    ['e2e-codex-session', 'initializing', 'busy', true],
    ['e2e-opencode-session', 'awaiting_approval', 'attention', false],
    ['e2e-gemini-session', 'failed', 'failed', false],
  ] as const;
  for (const [sessionId, runtimeStatus, presentation, spins] of expectedRuntimeStates) {
    const row = sessionList.locator(`[data-agent-session-id="${sessionId}"]`);
    const statusSlot = row.locator('[data-session-runtime-status]');
    const providerBadge = row.locator('[data-session-provider-badge="leading"]');
    const trailingMetadata = row.locator('[data-session-trailing-metadata="true"]');
    await expect(row).toBeVisible();
    await expect(statusSlot).toHaveAttribute('data-session-runtime-status', runtimeStatus);
    await expect(statusSlot).toHaveAttribute('data-session-runtime-presentation', presentation);
    await expect(statusSlot.locator('.animate-spin')).toHaveCount(spins ? 1 : 0);
    await expect(providerBadge).toBeVisible();
    await expect(trailingMetadata).toHaveCount(1);
    expect(await row.evaluate((element) => {
      const provider = element.querySelector('[data-session-provider-badge="leading"]');
      const trailing = element.querySelector('[data-session-trailing-metadata="true"]');
      const status = element.querySelector('[data-session-runtime-status]');
      return Boolean(
        provider
        && trailing
        && status
        && (provider.compareDocumentPosition(trailing) & Node.DOCUMENT_POSITION_FOLLOWING)
        && status.parentElement === trailing
        && trailing.lastElementChild === status,
      );
    })).toBe(true);
  }

  await page.setViewportSize({ width: 760, height: 680 });
  for (const [sessionId, runtimeStatus] of expectedRuntimeStates) {
    const row = sessionList.locator(`[data-agent-session-id="${sessionId}"]`);
    const statusSlot = row.locator(`[data-session-runtime-status="${runtimeStatus}"]`);
    const providerBadge = row.locator('[data-session-provider-badge="leading"]');
    await expect(row).toBeVisible();
    await expect(statusSlot).toBeVisible();
    await expect(providerBadge).toBeVisible();
    const [rowBounds, statusBounds, providerBounds] = await Promise.all([
      row.boundingBox(),
      statusSlot.boundingBox(),
      providerBadge.boundingBox(),
    ]);
    expect(rowBounds).not.toBeNull();
    expect(statusBounds).not.toBeNull();
    expect(providerBounds).not.toBeNull();
    expect(rowBounds!.x).toBeGreaterThanOrEqual(0);
    expect(rowBounds!.x + rowBounds!.width).toBeLessThanOrEqual(760);
    expect(providerBounds!.x + providerBounds!.width).toBeLessThanOrEqual(statusBounds!.x);
  }
  await page.setViewportSize({ width: 1_440, height: 900 });

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
    'OpenCode verification',
    'Codex implementation',
  ]);
  expect(uniqueSmartOrderDetails.slice(0, 3)).toEqual([
    expect.stringContaining('anthropic'),
    expect.stringContaining('opencode'),
    expect.stringContaining('openai'),
  ]);

  let menu = await openOrganizeMenu(page);
  await expect(menu.getByRole('button', { name: 'Smart Priority', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Recent Activity', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Created', exact: true })).toBeVisible();
  await menu.getByRole('button', { name: 'By Provider', exact: true }).click();

  await expect(sessionList.getByText('Claude architecture review', { exact: true })).toBeVisible();
  await expect(sessionList.getByText('Codex implementation', { exact: true })).toBeVisible();
  await expect(sessionList.getByText('OpenCode verification', { exact: true })).toBeVisible();

  await revealSessionByLoadingMore(sessionList, 'History page two session');

  menu = await openOrganizeMenu(page);
  await menu.getByRole('button', { name: 'Chronological', exact: true }).click();
  await revealSessionByLoadingMore(sessionList, 'History page three session');

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

test('direct Studio startup mounts the full surface and renders Session activity rows', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  await page.setViewportSize({ width: 1_440, height: 900 });

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const failedResponses: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('requestfailed', (request) => {
    failedRequests.push(
      `${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'unknown error'}`,
    );
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push(
        `${response.status()} ${response.request().method()} ${response.url()}`,
      );
    }
  });
  const activityResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'GET'
      && url.pathname === '/app/v3/api/ai/session_activity_summaries';
  });

  await page.goto(
    '/?tab=studio&projectId=project.e2e-1&sessionId=e2e-claude-session',
  );

  const studioSurface = page.locator('[data-studio-surface="true"]');
  const studioHeader = studioSurface.locator('[data-studio-chat-header="true"]');
  try {
    await expect(studioSurface).toBeVisible({ timeout: 60_000 });
  } catch (error) {
    const bodyText = (await page.locator('body').innerText()).slice(0, 2_000);
    const diagnostics = JSON.stringify({
      bodyText,
      consoleErrors,
      failedRequests,
      failedResponses,
      pageErrors,
      title: await page.title(),
      url: page.url(),
    }, null, 2);
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nStudio startup diagnostics:\n${diagnostics}`,
    );
  }
  await expect(studioHeader).toContainText('E2E Project');

  const activityResponse = await activityResponsePromise;
  expect(activityResponse.ok()).toBe(true);
  expect(new URL(activityResponse.url()).searchParams.get('workspace_id'))
    .toBe('workspace.e2e-default');

  await studioSurface.locator('[data-studio-session-menu-trigger="true"]').click();
  const sessionMenu = studioSurface.locator('[data-studio-session-menu="true"]');
  await expect(sessionMenu).toBeVisible();
  await expect(sessionMenu).toHaveAttribute('role', 'dialog');
  await expect(sessionMenu.locator('[data-studio-session-menu-header="true"]')).toHaveCSS(
    'height',
    '44px',
  );
  await expect(sessionMenu.locator('[data-studio-projects-header="true"]')).toHaveCSS(
    'height',
    '40px',
  );
  await expect(sessionMenu.locator('[data-studio-sessions-header="true"]')).toHaveCSS(
    'height',
    '40px',
  );
  await expect(sessionMenu.getByRole('button', { name: 'New Project' })).toHaveCount(1);
  await expect(sessionMenu.getByRole('button', { name: 'Open Folder' })).toHaveCount(0);
  await expect(sessionMenu.getByRole('button', { name: 'Refresh Sessions' })).toBeVisible();
  await expect(sessionMenu.getByRole('button', { name: 'New task', exact: true })).toBeVisible();
  await expect(sessionMenu.getByRole('button', { name: 'Refresh Messages' })).toHaveCount(0);

  const expectedRuntimeStates = [
    ['e2e-claude-session', 'streaming', 'busy', true],
    ['e2e-codex-session', 'initializing', 'busy', true],
    ['e2e-opencode-session', 'awaiting_approval', 'attention', false],
    ['e2e-gemini-session', 'failed', 'failed', false],
  ] as const;
  for (const [sessionId, runtimeStatus, presentation, spins] of expectedRuntimeStates) {
    const row = sessionMenu.locator(`[data-agent-session-id="${sessionId}"]`);
    const statusSlot = row.locator('[data-session-runtime-status]');
    const providerBadge = row.locator(':scope > [data-session-provider-badge="leading"]');
    const trailingMetadata = row.locator(':scope > [data-session-trailing-metadata="true"]');
    await expect(row).toBeVisible();
    await expect(statusSlot).toHaveAttribute('data-session-runtime-status', runtimeStatus);
    await expect(statusSlot).toHaveAttribute('data-session-runtime-presentation', presentation);
    await expect(statusSlot.locator('.animate-spin')).toHaveCount(spins ? 1 : 0);
    await expect(providerBadge).toBeVisible();
    await expect(trailingMetadata).toHaveCount(1);
    expect(await row.evaluate((element) => {
      const provider = element.querySelector('[data-session-provider-badge="leading"]');
      const trailing = element.querySelector('[data-session-trailing-metadata="true"]');
      const status = element.querySelector('[data-session-runtime-status]');
      return Boolean(
        provider
        && trailing
        && status
        && (provider.compareDocumentPosition(trailing) & Node.DOCUMENT_POSITION_FOLLOWING)
        && status.parentElement === trailing
        && trailing.lastElementChild === status,
      );
    })).toBe(true);
  }

  await expect(sessionMenu.locator('[data-agent-session-id="e2e-claude-session"]'))
    .toHaveAttribute('data-session-selected', 'true');
  await sessionMenu.locator('[data-agent-session-id="e2e-codex-session"]').click();
  await expect(sessionMenu).toHaveCount(0);
  await expect(studioHeader).toContainText('Codex implementation');

  await studioSurface.locator('[data-studio-session-menu-trigger="true"]').click();
  await expect(sessionMenu).toBeVisible();
  const showMoreSessions = sessionMenu.getByRole('button', { name: 'Show more', exact: true });
  await expect(showMoreSessions).toBeVisible();
  await showMoreSessions.click();

  const unknownRow = sessionMenu.locator('[data-agent-session-id="e2e-history-session-1"]');
  const unknownTrailingMetadata = unknownRow.locator(
    ':scope > [data-session-trailing-metadata="true"]',
  );
  await expect(unknownRow).toBeVisible();
  await expect(unknownTrailingMetadata).toHaveCount(1);
  await expect(unknownRow.locator('[data-session-runtime-status]')).toHaveCount(0);
  await expect(unknownRow.locator('[data-session-runtime-status-icon]')).toHaveCount(0);
  expect(await unknownRow.evaluate((element) => {
    const provider = element.querySelector('[data-session-provider-badge="leading"]');
    const trailing = element.querySelector('[data-session-trailing-metadata="true"]');
    return Boolean(
      provider
      && trailing
      && (provider.compareDocumentPosition(trailing) & Node.DOCUMENT_POSITION_FOLLOWING)
      && trailing.children.length === 1,
    );
  })).toBe(true);

  const staleRow = sessionMenu.locator('[data-agent-session-id="e2e-history-session-2"]');
  let staleRevealAttempts = 0;
  while (!(await staleRow.isVisible()) && staleRevealAttempts < 4) {
    await expect(showMoreSessions).toBeVisible();
    await showMoreSessions.click();
    staleRevealAttempts += 1;
  }
  const staleStatusSlot = staleRow.locator('[data-session-runtime-status="stale"]');
  await expect(staleRow).toBeVisible();
  await expect(staleStatusSlot).toHaveAttribute('data-session-runtime-presentation', 'neutral');
  await expect(staleStatusSlot).toHaveAttribute('data-session-runtime-status-icon', 'neutral');
  await expect(staleStatusSlot.locator('.animate-spin')).toHaveCount(0);
  expect(pageErrors.filter((message) => (
    !message.includes("The document is sandboxed and lacks the 'allow-same-origin' flag")
  ))).toEqual([]);
});

test('Studio keeps its project switcher open while shared project creation refreshes the list', async ({
  page,
  request,
}, testInfo) => {
  await bootstrapAuthenticatedSession(page, request);
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.goto('/?tab=studio&projectId=project.e2e-1&sessionId=e2e-claude-session');

  const studioSurface = page.locator('[data-studio-surface="true"]');
  await expect(studioSurface).toBeVisible({ timeout: 60_000 });
  await studioSurface.locator('[data-studio-session-menu-trigger="true"]').click();

  const sessionMenu = studioSurface.locator('[data-studio-session-menu="true"]');
  const newProjectButton = sessionMenu.getByRole('button', { name: 'New Project' });
  await expect(sessionMenu).toBeVisible();
  await expect(newProjectButton).toHaveCount(1);
  await expect(sessionMenu.getByRole('button', { name: 'Open Folder' })).toHaveCount(0);
  await newProjectButton.click();

  const createProjectDialog = page.getByRole('dialog', { name: 'Create project' });
  await expect(createProjectDialog).toBeVisible();
  await expect(sessionMenu).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('studio-shared-create-dialog.png'),
    fullPage: true,
  });
  await createProjectDialog.getByRole('textbox', { name: 'Project name' })
    .fill('Studio Shared Project');

  const projectCreateResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/app/v3/api/ai/projects'
  ));
  await createProjectDialog.getByRole('button', {
    exact: true,
    name: 'Create project',
  }).click();
  expect((await projectCreateResponse).ok()).toBe(true);

  await expect(createProjectDialog).toHaveCount(0);
  await expect(sessionMenu).toBeVisible();
  await expect(sessionMenu.getByText('Studio Shared Project', { exact: true })).toBeVisible();
  await expect(studioSurface.locator('[data-studio-chat-header="true"]'))
    .toContainText('Studio Shared Project');
  await page.screenshot({
    path: testInfo.outputPath('studio-project-list-refreshed.png'),
    fullPage: true,
  });
});
