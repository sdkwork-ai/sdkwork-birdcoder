import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;
const codexSessionId = 'e2e-codex-session';
const turnInputQueuePath = `/sessions/${codexSessionId}/turn_input_queue`;

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

async function bootstrapAuthenticatedContext(
  context: BrowserContext,
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
  await context.addInitScript((session) => {
    localStorage.setItem('sdkwork.birdcoder.appSession.v1', JSON.stringify({
      ...session,
      expiresAt: Math.floor(Date.parse(session.expiresAt) / 1_000),
      storedAt: Math.floor(Date.now() / 1_000),
    }));
  }, payload.data);
}

async function exposeCompletedCodexSessionActivity(page: Page): Promise<void> {
  await page.route(/\/app\/v3\/api\/ai\/session_activity_summaries(?:\?.*)?$/u, async (route) => {
    const response = await route.fetch();
    const payload = await response.json() as SessionActivitySummaryEnvelopeFixture;
    const codexActivity = payload.data?.items?.find(
      (item) => item.session?.sessionId === codexSessionId,
    );
    if (codexActivity) {
      codexActivity.presentationPhase = 'idle';
      if (codexActivity.providerActivity) {
        codexActivity.providerActivity.state = 'idle';
      }
      if (codexActivity.latestTurn) {
        codexActivity.latestTurn.status = 'completed';
        codexActivity.latestTurn.responseItemId = `activity-response-item.${codexSessionId}`;
        codexActivity.latestTurn.completedAt = '2026-01-01T00:20:00.000Z';
      }
    }
    await route.fulfill({ response, json: payload });
  });
}

async function openCodexSession(page: Page): Promise<void> {
  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  const codexSession = page.getByText('Codex implementation', { exact: true });
  const expandProject = page.getByRole('button', { name: 'Expand E2E Project' });
  await expect.poll(async () => (
    await codexSession.count() > 0 || await expandProject.count() > 0
  ), { timeout: 60_000 }).toBe(true);
  if (await codexSession.count() === 0) {
    await expandProject.click();
  }
  const sessionRow = page.locator(`[data-agent-session-id="${codexSessionId}"]`);
  await sessionRow.locator(':scope > button[aria-label]').click();
  await expect(sessionRow).toHaveClass(/birdcoder-session-selected/u);
  await expect(page.locator(
    'textarea[placeholder="Ask anything or request changes..."]:visible',
  )).toHaveCount(1);
}

function observeQueuedTurnSubmissions(page: Page, contents: string[]): void {
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      request.method() === 'POST'
      && url.pathname.endsWith(`/sessions/${codexSessionId}/turns`)
    ) {
      const body = request.postDataJSON() as { content?: unknown };
      if (typeof body.content === 'string') {
        contents.push(body.content);
      }
    }
  });
}

async function expectSingleQueuedMessage(page: Page, message: string): Promise<void> {
  const queueSummary = page.getByRole('button', {
    name: 'Queued messages (1)',
    exact: true,
  });
  await expect(queueSummary).toBeVisible();
  await expect(queueSummary).toContainText(message);
}

async function expectQueuedMessageOrCompletedClaim(page: Page, message: string): Promise<void> {
  const queueSummary = page.getByRole('button', {
    name: 'Queued messages (1)',
    exact: true,
  });
  const completedResponse = page.getByText(
    `Mock assistant response to: ${message}`,
    { exact: true },
  );

  await expect.poll(async () => {
    if (await queueSummary.count() > 0) {
      return await queueSummary.getByText(message, { exact: true }).count() > 0
        ? 'queued'
        : 'queue-mismatch';
    }
    return await completedResponse.count() > 0 ? 'claimed' : 'pending';
  }, {
    message: 'The reloaded Session must preserve the queued input or its completed claim.',
    timeout: 30_000,
  }).toMatch(/^(?:claimed|queued)$/u);
}

test('durable queued input survives reload and is claimed once across windows', async ({
  context,
  page,
  request,
}) => {
  await bootstrapAuthenticatedContext(context, request);
  await exposeCompletedCodexSessionActivity(page);
  await page.setViewportSize({ width: 1_440, height: 900 });
  const submittedTurnContents: string[] = [];
  observeQueuedTurnSubmissions(page, submittedTurnContents);
  await openCodexSession(page);

  const composer = page.locator(
    'textarea[placeholder="Ask anything or request changes..."]:visible',
  );
  const blockingMessage = `E2E durable queue blocker ${Date.now()}`;
  const queuedMessage = `E2E durable queued input ${Date.now()}`;
  await composer.fill(blockingMessage);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop response', exact: true })).toBeVisible();

  const createQueueResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'POST'
      && url.pathname.endsWith(turnInputQueuePath);
  });
  await composer.fill(queuedMessage);
  await page.getByRole('button', { name: 'Queue message', exact: true }).click();
  expect((await createQueueResponse).status()).toBe(201);
  await expectSingleQueuedMessage(page, queuedMessage);

  const secondPage = await context.newPage();
  await exposeCompletedCodexSessionActivity(secondPage);
  await secondPage.setViewportSize({ width: 1_440, height: 900 });
  observeQueuedTurnSubmissions(secondPage, submittedTurnContents);
  await openCodexSession(secondPage);
  await expectSingleQueuedMessage(secondPage, queuedMessage);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  const reloadedSessionRow = page.locator(`[data-agent-session-id="${codexSessionId}"]`);
  await reloadedSessionRow.locator(':scope > button[aria-label]').click();
  await expectQueuedMessageOrCompletedClaim(page, queuedMessage);

  await expect.poll(() => submittedTurnContents.filter(
    (content) => content === queuedMessage,
  ).length, { timeout: 30_000 }).toBe(1);
  await expect.poll(async () => {
    const firstCount = await page.getByText(
      `Mock assistant response to: ${queuedMessage}`,
      { exact: true },
    ).count();
    const secondCount = await secondPage.getByText(
      `Mock assistant response to: ${queuedMessage}`,
      { exact: true },
    ).count();
    return firstCount + secondCount;
  }, { timeout: 30_000 }).toBeGreaterThanOrEqual(1);

  await page.waitForTimeout(2_500);
  expect(submittedTurnContents.filter((content) => content === queuedMessage)).toHaveLength(1);
  await secondPage.close();
});
