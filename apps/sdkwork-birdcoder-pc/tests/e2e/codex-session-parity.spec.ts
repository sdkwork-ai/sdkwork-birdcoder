import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;
const codexSessionId = 'e2e-codex-session';

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

test('Codex canonical Session presents history and completes a streamed Turn', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  await exposeCompletedCodexSessionActivity(page);
  await page.setViewportSize({ width: 1_440, height: 900 });

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  let codexTurnRequestCount = 0;
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      request.method() === 'POST'
      && url.pathname.endsWith(`/sessions/${codexSessionId}/turns`)
    ) {
      codexTurnRequestCount += 1;
    }
  });

  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  await expandProjectSessions(page);

  const sessionRow = page.locator(`[data-agent-session-id="${codexSessionId}"]`);
  const sessionButton = sessionRow.locator(':scope > button[aria-label]');
  const initialItemsResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'POST'
      && url.pathname.endsWith(`/sessions/${codexSessionId}/items/synchronize`)
      && !url.searchParams.has('cursor');
  });
  await sessionButton.click();
  const initialItems = await initialItemsResponse;
  expect(initialItems.ok()).toBe(true);
  expect(new URL(initialItems.url()).pathname).toContain(
    `/sessions/${codexSessionId}/items/synchronize`,
  );
  await expect(sessionRow).toHaveClass(/birdcoder-session-selected/u);

  const transcript = page.getByRole('region', { name: 'Conversation messages' });
  await expect(transcript.locator('[data-chat-user-text="true"]').filter({
    hasText: 'Inspect this Codex screenshot and the attached protocol notes.',
  })).toHaveCount(1);
  await expect(transcript.getByText(
    'Codex completed the provider-neutral file presentation.',
    { exact: true },
  )).toHaveCount(1);
  await expect(
    transcript.locator('[data-chat-engine="codex"][data-chat-engine-protocol="codex.item"]'),
  ).not.toHaveCount(0);

  const processDisclosure = transcript.getByRole('button', {
    name: /Processed.*Show execution process/u,
  });
  await expect(processDisclosure).toHaveCount(1);
  await processDisclosure.click();
  const completedLifecycle = transcript.locator('[data-chat-lifecycle-event="completed"]');
  await expect(completedLifecycle).toHaveCount(1);
  await expect(completedLifecycle).toContainText('Turn completed');
  await expect(completedLifecycle).toContainText('2.3k tokens');
  const compactedLifecycle = transcript.locator('[data-chat-lifecycle-event="compacted"]');
  await expect(compactedLifecycle).toHaveCount(1);
  await expect(compactedLifecycle).toContainText('Context compacted');

  const imageResourceGroups = transcript
    .locator('[data-chat-message-resources]')
    .filter({ has: page.locator('[data-chat-message-resource="image"]') });
  await expect(imageResourceGroups).toHaveCount(2);
  await expect(imageResourceGroups.nth(0).locator('[data-chat-message-resource="image"]'))
    .toHaveCount(2);
  await expect(imageResourceGroups.nth(0)).toContainText('codex-image-consecutive-1.png');
  await expect(imageResourceGroups.nth(0)).toContainText('codex-image-consecutive-2.png');
  await expect(imageResourceGroups.nth(1).locator('[data-chat-message-resource="image"]'))
    .toHaveCount(1);
  await expect(imageResourceGroups.nth(1)).toContainText('codex-image-after-sleep.png');
  await expect(transcript).not.toContainText('INTERNAL_CODEX_ENTERED_REVIEW_MODE_MUST_NOT_RENDER');
  await expect(transcript).not.toContainText('INTERNAL_CODEX_EXITED_REVIEW_MODE_MUST_NOT_RENDER');

  const fileChanges = transcript.locator('[data-chat-turn-file-changes="true"]');
  await expect(fileChanges).toHaveCount(1);
  await expect(fileChanges).toHaveAttribute('data-chat-turn-file-count', '1');
  await expect(fileChanges).toContainText('src/');
  await expect(fileChanges).toContainText('index.ts');
  await expect(fileChanges.locator('[data-chat-turn-file-impact="true"]')).toContainText('+1');
  await expect(fileChanges.locator('[data-chat-turn-file-impact="true"]')).toContainText('-1');
  await fileChanges.locator('[data-chat-file-disclosure="true"]').click();
  await expect(fileChanges.locator('[data-chat-file-inline-diff="true"]')).toContainText(
    "applicationName = 'BirdCoder Codex'",
  );
  await expect.poll(() => fileChanges.evaluate((element) => {
    const messageSurface = element.closest('[data-chat-engine]');
    return [
      messageSurface?.getAttribute('data-chat-engine'),
      messageSurface?.getAttribute('data-chat-engine-protocol'),
    ];
  })).toEqual(['codex', 'codex.item']);

  const message = `Codex Session parity send ${Date.now()}`;
  const assistantResponse = `Mock assistant response to: ${message}`;
  const firstAssistantDelta = assistantResponse.slice(
    0,
    Math.max(1, Math.floor(assistantResponse.length / 2)),
  );
  const composer = page.locator(
    'textarea[placeholder="Ask anything or request changes..."]:visible',
  );
  await expect(composer).toHaveCount(1);
  await composer.fill(message);

  const turnResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'POST'
      && url.pathname.endsWith(`/sessions/${codexSessionId}/turns`);
  });
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect.poll(() => codexTurnRequestCount).toBe(1);
  await expect(transcript.getByText(firstAssistantDelta, { exact: true })).toBeVisible();
  await expect(transcript.getByText(assistantResponse, { exact: true })).toHaveCount(0);

  const submittedTurn = await turnResponse;
  expect(submittedTurn.ok()).toBe(true);
  const submittedTurnUrl = new URL(submittedTurn.url());
  expect(submittedTurnUrl.searchParams.get('stream')).toBe('true');
  expect(submittedTurn.request().postDataJSON()).toMatchObject({
    content: message,
    requestedModelId: 'gpt-5-codex',
    runtimeBindingId: `runtime-binding.${codexSessionId}`,
    turnId: expect.stringMatching(/^turn\./u),
  });

  await expect(transcript.getByText(message, { exact: true })).toHaveCount(1);
  await expect(transcript.getByText(assistantResponse, { exact: true })).toHaveCount(1);
  await expect(transcript.getByText(firstAssistantDelta, { exact: true })).toHaveCount(0);
  await expect(composer).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeVisible();
  expect(codexTurnRequestCount).toBe(1);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter((entry) => (
    /codex|session items|transcript|send message|stream|undefined.*map/iu.test(entry)
  ))).toEqual([]);
});
