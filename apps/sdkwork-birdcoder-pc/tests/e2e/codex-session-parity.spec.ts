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
  await expect(transcript).not.toContainText(
    'Codex commentary is visible only inside the execution process.',
  );
  await processDisclosure.click();
  await expect(transcript).toContainText(
    'Codex commentary is visible only inside the execution process.',
  );
  const completedLifecycle = transcript.locator('[data-chat-lifecycle-event="completed"]');
  await expect(completedLifecycle).toHaveCount(1);
  await expect(completedLifecycle).toContainText('Turn completed');
  await expect(completedLifecycle).toContainText('2.3k tokens');
  const compactedLifecycle = transcript.locator('[data-chat-lifecycle-event="compacted"]');
  await expect(compactedLifecycle).toHaveCount(1);
  await expect(compactedLifecycle).toContainText('Context compacted');

  const commandActivity = transcript.locator('[data-chat-activity-summary="inline"]');
  await expect(commandActivity).toHaveCount(1);
  const commandActivityDisclosure = commandActivity.locator(':scope > button').first();
  await expect(commandActivityDisclosure).toContainText('Ran commands');
  await expect(commandActivityDisclosure).toHaveAccessibleName(
    'Ran 2 commands. Show activity details',
  );
  await expect(commandActivityDisclosure).toHaveAttribute('aria-expanded', 'false');
  await commandActivityDisclosure.click();
  const commandDisclosures = commandActivity.locator('[data-chat-command-disclosure="true"]');
  await expect(commandDisclosures).toHaveCount(2);
  await commandDisclosures.nth(0).click();
  await commandDisclosures.nth(1).click();
  const commandDetails = commandActivity.locator('[data-chat-command-details="true"]');
  await expect(commandDetails).toHaveCount(2);
  await expect(commandDetails.nth(0)).toContainText('pnpm typecheck');
  await expect(commandDetails.nth(0)).toContainText('TypeScript check passed.');
  await expect(commandDetails.nth(1)).toContainText('pnpm test -- --runInBand');
  await expect(commandDetails.nth(1)).toContainText('All focused tests passed.');

  const imageActivityGroups = transcript.locator('[data-chat-inspected-images="true"]');
  await expect(imageActivityGroups).toHaveCount(2);

  const consecutiveImageActivity = imageActivityGroups.nth(0);
  const consecutiveImageDisclosure = consecutiveImageActivity.locator(':scope > button').first();
  await expect(consecutiveImageDisclosure).toHaveAccessibleName(
    'Viewed 2 images. Show inspected images',
  );
  await expect(consecutiveImageDisclosure).toHaveAttribute('aria-expanded', 'false');
  await consecutiveImageDisclosure.click();
  await expect(consecutiveImageDisclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(consecutiveImageDisclosure).toHaveAccessibleName(
    'Viewed 2 images. Hide inspected images',
  );
  const consecutiveImageThumbnails = consecutiveImageActivity.locator(
    '[data-chat-inspected-image-thumbnails="true"]',
  );
  await expect(consecutiveImageThumbnails).toBeVisible();
  await expect(consecutiveImageThumbnails.getByRole('button', {
    name: 'Preview image: E:\\workspace\\codex-image-consecutive-1.png',
  })).toHaveCount(1);
  await expect(consecutiveImageThumbnails.getByRole('button', {
    name: 'Preview image: E:\\workspace\\codex-image-consecutive-2.png',
  })).toHaveCount(1);
  const firstImagePreviewButton = consecutiveImageThumbnails.getByRole('button', {
    name: 'Preview image: E:\\workspace\\codex-image-consecutive-1.png',
  });
  await expect(firstImagePreviewButton).toBeEnabled();
  await expect.poll(() => firstImagePreviewButton.locator('img').evaluate((image) => (
    image instanceof HTMLImageElement ? image.naturalWidth : 0
  ))).toBeGreaterThan(0);
  await firstImagePreviewButton.click();
  const inspectedImageDialog = page.locator('[data-chat-inspected-image-dialog="true"]');
  await expect(inspectedImageDialog).toBeVisible();
  await expect(inspectedImageDialog.getByText('1 / 2', { exact: true })).toBeVisible();
  await inspectedImageDialog.getByRole('button', { name: 'Next image' }).click();
  await expect(inspectedImageDialog.getByText('2 / 2', { exact: true })).toBeVisible();
  await inspectedImageDialog.getByRole('button', { name: 'Close image preview' }).click();
  await expect(inspectedImageDialog).toHaveCount(0);
  await expect(firstImagePreviewButton).toBeFocused();

  const laterImageActivity = imageActivityGroups.nth(1);
  await expect(laterImageActivity.getByRole('button', {
    name: 'Viewed an image. Show inspected images',
  })).toHaveAttribute('aria-expanded', 'false');
  await page.setViewportSize({ width: 900, height: 800 });
  await expect.poll(() => transcript.evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  await expect.poll(() => consecutiveImageActivity.evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  await page.setViewportSize({ width: 1_440, height: 900 });
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

  // Codex dynamicToolCall (update_plan) and webSearch project to typed tool
  // rows once the earlier item page is loaded.
  await transcript.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  const loadEarlier = transcript.getByRole('button', {
    name: 'Load earlier messages',
    exact: true,
  });
  await expect(loadEarlier).toBeVisible({ timeout: 15_000 });
  await loadEarlier.click();
  const dynamicToolCall = transcript.locator(
    '[data-chat-tool-kind="task"][data-chat-tool-name="update_plan"]',
  );
  for (let attempt = 0; attempt < 8 && await dynamicToolCall.count() === 0; attempt += 1) {
    await transcript.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(500);
  }
  await expect(dynamicToolCall).toHaveCount(1);
  await expect(dynamicToolCall).toContainText('Updated task');
  const webSearchRow = transcript.locator('[data-chat-tool-kind="web"]');
  await expect(webSearchRow).toHaveCount(1);
  await expect(webSearchRow).toContainText('Searched the web');
  await expect(webSearchRow).toContainText('SDKWork BirdCoder provider protocol');

  // Codex collabAgentToolCall spawns an agent row and subAgentActivity
  // renders the bare "{displayName} started working" line.
  const collabAgentRow = transcript.locator(
    '[data-chat-tool-kind="agent"][data-chat-tool-name="spawnAgent"]',
  );
  for (let attempt = 0; attempt < 8 && await collabAgentRow.count() === 0; attempt += 1) {
    await transcript.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(500);
  }
  await expect(collabAgentRow).toHaveCount(1);
  await expect(collabAgentRow).toContainText('Created');
  await expect(collabAgentRow).toContainText('1 agent');
  const subagentActivityRow = transcript.locator('[data-chat-tool-kind="agent"]').filter({
    hasText: 'Code reviewer started working',
  });
  for (let attempt = 0; attempt < 8 && await subagentActivityRow.count() === 0; attempt += 1) {
    await transcript.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(500);
  }
  await expect(subagentActivityRow).toHaveCount(1);
  await expect(subagentActivityRow).not.toContainText('Running');

  // Codex imageGeneration renders a media row labeled `Generated image`
  // with the generated picture as result evidence; `sleep` never renders a
  // transcript row; hookPrompt merges its non-empty fragments into one
  // hook-feedback user message.
  const generatedImageRow = transcript.locator(
    '[data-chat-tool-kind="media"][data-chat-tool-name="image_generation"]',
  );
  for (let attempt = 0; attempt < 8 && await generatedImageRow.count() === 0; attempt += 1) {
    await transcript.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(500);
  }
  await expect(generatedImageRow).toHaveCount(1);
  await expect(generatedImageRow).toContainText('Generated image');
  await generatedImageRow.locator('[data-chat-tool-disclosure="true"]').click();
  await expect(generatedImageRow.locator('[data-chat-tool-result-blocks="true"] img')).toHaveCount(1);
  await expect(generatedImageRow.locator('[data-chat-tool-result-blocks="true"] img')).toHaveAttribute(
    'src',
    /^data:image\/png;base64,/u,
  );
  await expect(transcript.getByText(/sleep/iu)).toHaveCount(0);
  await expect(transcript.locator('[data-chat-user-text="true"]').filter({
    hasText: 'Codex hook prompt feedback | second fragment',
  })).toHaveCount(1);

  // Codex mcpToolCall failure renders the explicit "Failed to call" verb,
  // the `server / tool` identity, and the bounded error evidence.
  const failedMcpRow = transcript.locator(
    '[data-chat-tool-kind="mcp"][data-chat-tool-name="get_issue"]',
  );
  for (let attempt = 0; attempt < 8 && await failedMcpRow.count() === 0; attempt += 1) {
    await transcript.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(500);
  }
  await expect(failedMcpRow).toHaveCount(1);
  await expect(failedMcpRow).toContainText('Failed to call');
  await expect(failedMcpRow).toContainText('github / Get issue');
  await expect(failedMcpRow.locator('[data-chat-tool-status="error"]')).toHaveCount(1);
  await failedMcpRow.locator('[data-chat-tool-disclosure="true"]').click();
  await expect(failedMcpRow).toContainText('API rate limit exceeded');

  // Codex reasoning items render their non-empty summary inside the turn
  // execution process, and `plan` text renders as durable assistant
  // content in the transcript.
  await expect(transcript).toContainText('Checked the provider-neutral presentation surfaces');
  await expect(transcript).toContainText(
    'Verify every transcript surface renders the provider-neutral presentation.',
  );

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
