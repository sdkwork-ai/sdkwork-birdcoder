import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;
const codexSessionId = 'e2e-codex-session';
const mockCompletionDelayMs = 4_000;

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

interface TurnSubmissionFixture {
  content?: unknown;
  turnId?: unknown;
}

interface TurnCancellationFixture {
  expectedVersion?: unknown;
  requestedAt?: unknown;
}

interface TurnCancellationEnvelopeFixture {
  data?: {
    item?: {
      sessionId?: string;
      status?: string;
      turnId?: string;
    };
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

test('Codex canonical Session cancels the active Turn without committing completion', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  await exposeCompletedCodexSessionActivity(page);
  await page.setViewportSize({ width: 1_440, height: 900 });

  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  await expandProjectSessions(page);

  const sessionRow = page.locator(`[data-agent-session-id="${codexSessionId}"]`);
  const initialItemsResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'POST'
      && url.pathname.endsWith(`/sessions/${codexSessionId}/items/synchronize`)
      && !url.searchParams.has('cursor');
  });
  await sessionRow.locator(':scope > button[aria-label]').click();
  expect((await initialItemsResponse).ok()).toBe(true);
  await expect(sessionRow).toHaveClass(/birdcoder-session-selected/u);

  const transcript = page.getByRole('region', { name: 'Conversation messages' });
  const composer = page.locator(
    'textarea[placeholder="Ask anything or request changes..."]:visible',
  );
  const message = `Codex Session cancellation ${Date.now()}`;
  const assistantResponse = `Mock assistant response to: ${message}`;
  const firstAssistantDelta = assistantResponse.slice(
    0,
    Math.max(1, Math.floor(assistantResponse.length / 2)),
  );
  await expect(composer).toHaveCount(1);
  await composer.fill(message);

  const createTurnRequest = page.waitForRequest((candidate) => {
    const url = new URL(candidate.url());
    return candidate.method() === 'POST'
      && url.pathname.endsWith(`/sessions/${codexSessionId}/turns`);
  });
  const createTurnResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'POST'
      && url.pathname.endsWith(`/sessions/${codexSessionId}/turns`);
  });
  await page.getByRole('button', { name: 'Send message', exact: true }).click();

  const submittedTurnRequest = await createTurnRequest;
  const submittedTurnResponse = await createTurnResponse;
  expect(submittedTurnResponse.ok()).toBe(true);
  const submittedTurn = submittedTurnRequest.postDataJSON() as TurnSubmissionFixture;
  expect(submittedTurn.content).toBe(message);
  const turnId = String(submittedTurn.turnId ?? '');
  expect(turnId).toMatch(/^turn\./u);

  const createTurnPath = decodeURIComponent(new URL(submittedTurnRequest.url()).pathname);
  expect(createTurnPath).toContain(`/sessions/${codexSessionId}/turns`);
  const cancelTurnPath = `${createTurnPath}/${turnId}/cancel`;

  await expect(transcript.getByText(firstAssistantDelta, { exact: true })).toBeVisible();
  await expect(transcript.getByText(assistantResponse, { exact: true })).toHaveCount(0);

  const cancelTurnResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
      && decodeURIComponent(new URL(response.url()).pathname) === cancelTurnPath
  ));
  const stopResponse = page.getByRole('button', { name: 'Stop response', exact: true });
  await expect(stopResponse).toBeVisible();
  await stopResponse.click();

  const cancelledTurnResponse = await cancelTurnResponse;
  expect(cancelledTurnResponse.ok()).toBe(true);
  const cancelledTurnUrl = decodeURIComponent(new URL(cancelledTurnResponse.url()).pathname);
  expect(cancelledTurnUrl).toBe(cancelTurnPath);
  expect(cancelledTurnUrl).toContain(`/sessions/${codexSessionId}/turns/${turnId}/cancel`);

  const cancellation = cancelledTurnResponse.request()
    .postDataJSON() as TurnCancellationFixture;
  expect(cancellation.expectedVersion).toEqual(expect.stringMatching(/^\d+$/u));
  const requestedAt = String(cancellation.requestedAt ?? '');
  expect(requestedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
  expect(new Date(requestedAt).toISOString()).toBe(requestedAt);

  const cancellationEnvelope = await cancelledTurnResponse.json() as
    TurnCancellationEnvelopeFixture;
  expect(cancellationEnvelope.data?.item).toMatchObject({
    sessionId: codexSessionId,
    status: 'cancelled',
    turnId,
  });

  await expect(composer).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeVisible();
  await page.waitForTimeout(mockCompletionDelayMs + 500);
  await expect(transcript.getByText(assistantResponse, { exact: true })).toHaveCount(0);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});
