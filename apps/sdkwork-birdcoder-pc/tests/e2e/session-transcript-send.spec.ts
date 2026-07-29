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
  const codexItemRequestedPages: number[] = [];
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
  await page.route(/\/e2e-codex-session\/items(?:\?.*)?$/u, async (route) => {
    codexItemRequestCount += 1;
    codexItemRequestedPages.push(
      Number(new URL(route.request().url()).searchParams.get('page') ?? 1),
    );
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
  await expect(transcript.getByText(
    'Codex completed the provider-neutral file presentation.',
    { exact: true },
  )).toBeVisible();
  expect(codexItemRequestedPages.every((pageNumber) => pageNumber === 1)).toBe(true);

  const loadEarlierMessages = transcript.getByRole('button', {
    name: 'Load earlier messages',
    exact: true,
  });
  await expect(loadEarlierMessages).toBeVisible();
  await loadEarlierMessages.click();
  await expect.poll(() => codexItemRequestedPages.includes(2)).toBe(true);
  await expect(page.getByRole('button', {
    name: /Go to conversation turn .*Codex historical message 7$/u,
  })).toHaveCount(1);
  const pageThreeResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/e2e-codex-session/items')
      && url.searchParams.get('page') === '3';
  });
  for (
    let attempt = 0;
    attempt < 3 && !codexItemRequestedPages.includes(3);
    attempt += 1
  ) {
    await transcript.focus();
    await page.keyboard.press('Home');
    await waitForTranscriptSettlement(page);
  }
  await expect.poll(() => codexItemRequestedPages.includes(3)).toBe(true);
  expect((await pageThreeResponse).ok()).toBe(true);
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
  await expect(page.getByText(/Cannot read properties of undefined/iu)).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter((entry) => (
    /session items|transcript|send message|undefined.*map/iu.test(entry)
  ))).toEqual([]);
});
