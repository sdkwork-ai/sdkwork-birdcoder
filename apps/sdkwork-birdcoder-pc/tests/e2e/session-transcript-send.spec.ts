import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;

interface SessionActivitySummaryFixture {
  latestTurn?: {
    completedAt?: string | null;
    responseItemId?: string | null;
    status?: string;
  };
  presentationPhase?: string;
  providerActivity?: {
    state?: string | null;
  } | null;
  session?: {
    sessionId?: string;
  };
}

interface SessionActivitySummaryEnvelopeFixture {
  data?: {
    items?: SessionActivitySummaryFixture[];
  };
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

async function waitForTranscriptSettlement(page: Page): Promise<void> {
  // A rapid session switch can replace the document while the frame barrier is
  // pending; retry against the new execution context instead of failing the UI
  // interaction test on a transient navigation race.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.evaluate(() => new Promise<void>((resolve) => {
        let remainingFrames = 12;
        const waitForNextFrame = () => {
          remainingFrames -= 1;
          if (remainingFrames <= 0) {
            resolve();
            return;
          }
          window.requestAnimationFrame(waitForNextFrame);
        };
        window.requestAnimationFrame(waitForNextFrame);
      }));
      return;
    } catch (error) {
      if (!(error instanceof Error) || !/Execution context was destroyed/iu.test(error.message)) {
        throw error;
      }
      await page.waitForLoadState('domcontentloaded').catch(() => undefined);
    }
  }
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
  const codexItemRequestUrls: URL[] = [];
  let codexTurnRequestCount = 0;

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route(/\/app\/v3\/api\/ai\/session_activity_summaries(?:\?.*)?$/u, async (route) => {
    const response = await route.fetch();
    const payload = await response.json() as SessionActivitySummaryEnvelopeFixture;
    const codexActivity = payload.data?.items?.find(
      (item) => item.session?.sessionId === 'e2e-codex-session',
    );
    if (codexActivity) {
      codexActivity.presentationPhase = 'idle';
      if (codexActivity.providerActivity) {
        codexActivity.providerActivity.state = 'idle';
      }
      if (codexActivity.latestTurn) {
        codexActivity.latestTurn.status = 'completed';
        codexActivity.latestTurn.responseItemId = 'activity-response-item.e2e-codex-session';
        codexActivity.latestTurn.completedAt = '2026-01-01T00:20:00.000Z';
      }
    }
    await route.fulfill({ response, json: payload });
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      request.method() === 'POST'
      && url.pathname.endsWith('/e2e-codex-session/turns')
    ) {
      codexTurnRequestCount += 1;
    }
  });
  await page.route(/\/e2e-codex-session\/items(?:\/synchronize)?(?:\?.*)?$/u, async (route) => {
    codexItemRequestCount += 1;
    codexItemRequestUrls.push(new URL(route.request().url()));
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

  const sessionList = page.locator('.project-explorer-scroll-region').last();
  const codexSession = sessionList
    .locator('[data-agent-session-id="e2e-codex-session"]')
    .locator(':scope > button[aria-label]');
  const openCodeSession = sessionList
    .locator('[data-agent-session-id="e2e-opencode-session"]')
    .locator(':scope > button[aria-label]');
  await codexSession.click();
  await expect.poll(() => codexItemRequestCount).toBe(1);
  // Provider sorting places OpenCode after the larger Codex history block.
  // Expand the bounded session window until the target row is actually visible.
  for (let expansion = 0; expansion < 8 && await openCodeSession.count() === 0; expansion += 1) {
    const loadMoreSessions = sessionList.getByRole('button', {
      name: 'Show more',
      exact: true,
    });
    const loadOlderSessions = sessionList.getByRole('button', {
      name: 'Show older',
      exact: true,
    });
    if (await loadMoreSessions.count() > 0) {
      await loadMoreSessions.click();
    } else if (await loadOlderSessions.count() > 0) {
      await loadOlderSessions.click();
    } else {
      break;
    }
    await page.waitForTimeout(100);
  }
  await expect(openCodeSession).toHaveCount(1);
  await openCodeSession.click();
  const reselectedInitialPageResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'POST'
      && url.pathname.endsWith('/e2e-codex-session/items/synchronize')
      && !url.searchParams.has('cursor')
      && !url.searchParams.has('page');
  });
  await codexSession.click();
  const reselectedInitialPage = await reselectedInitialPageResponse;
  const reselectedInitialPagePayload = await reselectedInitialPage.json() as {
    data: { pageInfo: { hasMore: boolean; nextCursor: string | null } };
  };
  const firstEarlierCursor = reselectedInitialPagePayload.data.pageInfo.nextCursor;
  expect(reselectedInitialPage.ok()).toBe(true);
  expect(reselectedInitialPagePayload.data.pageInfo.hasMore).toBe(true);
  expect(firstEarlierCursor).toEqual(expect.any(String));
  expect(firstEarlierCursor).not.toMatch(/^\d+$/u);

  const transcript = page.getByRole('region', { name: 'Conversation messages' });
  await expect.poll(() => codexItemRequestCount).toBeGreaterThanOrEqual(2);
  await expect(transcript.getByText(
    'Codex completed the provider-neutral file presentation.',
    { exact: true },
  )).toBeVisible();
  expect(codexItemRequestUrls.every((url) => !url.searchParams.has('page'))).toBe(true);

  const loadEarlierMessages = transcript.getByRole('button', {
    name: 'Load earlier messages',
    exact: true,
  });
  await expect(loadEarlierMessages).toBeVisible();
  const secondPageResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/e2e-codex-session/items')
      && url.searchParams.get('cursor') === firstEarlierCursor
      && !url.searchParams.has('page');
  });
  await loadEarlierMessages.click();
  const secondPage = await secondPageResponse;
  const secondPagePayload = await secondPage.json() as {
    data: { pageInfo: { hasMore: boolean; nextCursor: string | null } };
  };
  const secondEarlierCursor = secondPagePayload.data.pageInfo.nextCursor;
  expect(secondPage.ok()).toBe(true);
  expect(secondPagePayload.data.pageInfo.hasMore).toBe(true);
  expect(secondEarlierCursor).toEqual(expect.any(String));
  expect(secondEarlierCursor).not.toBe(firstEarlierCursor);
  await expect(page.getByRole('button', {
    name: /Go to conversation turn .*Codex historical message 13$/u,
  })).toHaveCount(1);
  const pageThreeResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/e2e-codex-session/items')
      && url.searchParams.get('cursor') === secondEarlierCursor
      && !url.searchParams.has('page');
  });
  for (
    let attempt = 0;
    attempt < 5 && !codexItemRequestUrls.some(
      (url) => url.searchParams.get('cursor') === secondEarlierCursor,
    );
    attempt += 1
  ) {
    await transcript.focus();
    await page.keyboard.press('Home');
    await waitForTranscriptSettlement(page);
  }
  await expect.poll(() => codexItemRequestUrls.some(
    (url) => url.searchParams.get('cursor') === secondEarlierCursor,
  )).toBe(true);
  expect((await pageThreeResponse).ok()).toBe(true);
  expect(codexItemRequestUrls.every((url) => !url.searchParams.has('page'))).toBe(true);
  await expect(loadEarlierMessages).toHaveCount(0);
  await expect(page.getByRole('button', {
    name: /Go to conversation turn .*Codex historical message 1$/u,
  })).toHaveCount(1);
  const earliestCodexMessage = transcript.getByText(
    'Codex historical message 1',
    { exact: true },
  );
  for (
    let attempt = 0;
    attempt < 3 && await earliestCodexMessage.count() === 0;
    attempt += 1
  ) {
    await transcript.focus();
    await page.keyboard.press('Home');
    await waitForTranscriptSettlement(page);
  }
  await expect(earliestCodexMessage).toBeVisible();

  const message = `E2E session send verification ${Date.now()}`;
  const composer = page.locator(
    'textarea[placeholder="Ask anything or request changes..."]:visible',
  );
  await expect(composer).toHaveCount(1);
  await composer.fill(message);
  const assistantResponse = `Mock assistant response to: ${message}`;
  const firstAssistantDelta = assistantResponse.slice(
    0,
    Math.max(1, Math.floor(assistantResponse.length / 2)),
  );
  const turnResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'POST'
      && url.pathname.endsWith('/e2e-codex-session/turns');
  });
  await page.locator('button[title="Send message"]:visible').click();
  await expect.poll(() => codexTurnRequestCount).toBe(1);
  await page.getByRole('button', {
    name: 'Jump to latest message',
    exact: true,
  }).click();
  await expect(transcript.getByText(firstAssistantDelta, { exact: true })).toBeVisible();
  const submittedTurnResponse = await turnResponse;
  expect(submittedTurnResponse.ok()).toBe(true);
  const submittedTurnUrl = new URL(submittedTurnResponse.url());
  expect(submittedTurnUrl.searchParams.get('stream')).toBe('true');
  expect(submittedTurnResponse.request().postDataJSON()).toMatchObject({
    content: message,
    requestedModelId: 'gpt-5-codex',
    runtimeBindingId: 'runtime-binding.e2e-codex-session',
    turnId: expect.stringMatching(/^turn\./u),
  });
  expect(codexTurnRequestCount).toBe(1);

  await expect(transcript.getByText(message, { exact: true })).toHaveCount(1);
  await expect(transcript.getByText(assistantResponse, {
    exact: true,
  })).toHaveCount(1);
  await expect(loadEarlierMessages).toHaveCount(0);
  await expect(composer).toHaveValue('');

  const sentUserBubble = transcript
    .locator('[data-user-message-bubble="true"]')
    .filter({ hasText: message });
  await expect(sentUserBubble).toHaveCount(1);
  await expect(sentUserBubble).toHaveAttribute('tabindex', '0');
  await expect(sentUserBubble).toHaveClass(/cursor-pointer/u);
  await sentUserBubble.dblclick();
  await expect(composer).toHaveValue(message);
  const cancelEdit = page.getByTitle('Cancel edit');
  await expect(cancelEdit).toBeVisible();
  await cancelEdit.click();
  await expect(composer).toHaveValue('');
  await expect(cancelEdit).toHaveCount(0);

  await expect(page.getByText(/Cannot read properties of undefined/iu)).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter((entry) => (
    /session items|transcript|send message|undefined.*map/iu.test(entry)
  ))).toEqual([]);
});
