import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;
const codexAgentId = 'agent.intelligence.codex';
const codexSessionId = 'e2e-codex-session';
const codexRuntimeBindingId = `runtime-binding.${codexSessionId}`;
const fixedTimestamp = '2026-07-31T08:00:00.000Z';

interface PendingInteractionFixture {
  claimExpiresAt: null;
  claimOwner: null;
  createdAt: string;
  fencingToken: string;
  interactionId: string;
  kind: 'approval' | 'user_question';
  options: Array<{ label: string; value: string }>;
  organizationId: string;
  prompt: string;
  providerInteractionId: string;
  resolution: null;
  resolvedAt: null;
  retentionUntil: null;
  runtimeBindingId: string;
  sessionId: string;
  status: 'pending';
  tenantId: string;
  turnId: string;
  updatedAt: string;
  version: string;
}

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

const approvalFixture: PendingInteractionFixture = {
  claimExpiresAt: null,
  claimOwner: null,
  createdAt: fixedTimestamp,
  fencingToken: '1',
  interactionId: 'interaction.codex.visual-approval',
  kind: 'approval',
  options: [],
  organizationId: 'organization.e2e',
  prompt: 'Approve the Codex visual parity file change.',
  providerInteractionId: 'provider-interaction.codex.visual-approval',
  resolution: null,
  resolvedAt: null,
  retentionUntil: null,
  runtimeBindingId: codexRuntimeBindingId,
  sessionId: codexSessionId,
  status: 'pending',
  tenantId: 'tenant.e2e',
  turnId: 'turn.codex.visual-parity',
  updatedAt: fixedTimestamp,
  version: '1',
};

const questionFixture: PendingInteractionFixture = {
  ...approvalFixture,
  interactionId: 'interaction.codex.visual-question',
  kind: 'user_question',
  options: [
    { label: 'Continue in this Session', value: 'continue' },
    { label: 'Wait for review', value: 'wait' },
  ],
  prompt: 'How should the Codex Session continue?',
  providerInteractionId: 'provider-interaction.codex.visual-question',
};

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
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      get: () => 'en-US',
    });
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      get: () => ['en-US', 'en'],
    });
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
        codexActivity.latestTurn.completedAt = fixedTimestamp;
        codexActivity.latestTurn.responseItemId = `activity-response-item.${codexSessionId}`;
        codexActivity.latestTurn.status = 'completed';
      }
    }
    await route.fulfill({ response, json: payload });
  });
}

async function exposeCodexPendingInteractions(
  page: Page,
  interactions: PendingInteractionFixture[],
): Promise<void> {
  await page.route(
    new RegExp(
      `/app/v3/api/ai/agents/${codexAgentId.replaceAll('.', '\\.')}`
      + `/sessions/${codexSessionId}/interactions(?:\\?.*)?$`,
      'u',
    ),
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        contentType: 'application/json',
        json: {
          code: 0,
          data: {
            items: interactions,
            pageInfo: {
              hasMore: false,
              mode: 'offset',
              page: 1,
              pageSize: 200,
              totalItems: String(interactions.length),
              totalPages: interactions.length > 0 ? 1 : 0,
            },
          },
          traceId: 'pc-e2e-codex-visual-interactions',
        },
        status: 200,
      });
    },
  );
}

async function expandProjectSessions(page: Page): Promise<void> {
  const codexSession = page.getByText('Codex implementation', { exact: true });
  const expandProject = page.getByRole('button', { name: 'Expand E2E Project' });
  const showOlderSessions = page.getByRole('button', {
    name: /^(?:Older sessions|Show more)$/u,
  }).first();
  await expect.poll(async () => (
    await codexSession.count() > 0
    || await expandProject.count() > 0
    || await showOlderSessions.count() > 0
  ), { timeout: 60_000 }).toBe(true);
  if (await codexSession.count() === 0 && await expandProject.isVisible()) {
    await expandProject.click();
  }
  if (await codexSession.count() === 0 && await showOlderSessions.isVisible()) {
    await showOlderSessions.click();
  }
  await expect(codexSession).toBeVisible();
}

async function waitForStableVisualState(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
      [data-agent-session-id="e2e-history-session-1"]
      [data-session-trailing-metadata="true"] > span:first-child {
        font-size: 0 !important;
      }
      [data-agent-session-id="e2e-history-session-1"]
      [data-session-trailing-metadata="true"] > span:first-child::after {
        content: "Earlier";
        font-size: 10px;
      }
    `,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });
  });
}

async function assertVisualLayout(page: Page): Promise<void> {
  const geometry = await page.evaluate(() => {
    const composer = document.querySelector<HTMLElement>('[data-chat-composer-chrome="true"]');
    const interaction = document.querySelector<HTMLElement>(
      '[data-chat-pending-interactions="true"]',
    );
    const sessionList = document.querySelector<HTMLElement>('.birdcoder-session-list');
    const transcript = document.querySelector<HTMLElement>(
      '[role="region"][aria-label="Conversation messages"]',
    );
    if (!composer || !interaction || !sessionList || !transcript) {
      return null;
    }
    const composerRect = composer.getBoundingClientRect();
    const interactionRect = interaction.getBoundingClientRect();
    const transcriptRect = transcript.getBoundingClientRect();
    const interactionControls = [
      ...interaction.querySelectorAll<HTMLElement>('button, textarea'),
    ];
    return {
      composerBottom: composerRect.bottom,
      composerHorizontalOverflow: composer.scrollWidth - composer.clientWidth,
      composerTop: composerRect.top,
      documentHorizontalOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      interactionBottom: interactionRect.bottom,
      interactionControlHorizontalOverflow: Math.max(
        0,
        ...interactionControls.map((element) => element.scrollWidth - element.clientWidth),
      ),
      interactionControlOutsideBounds: interactionControls.some((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < interactionRect.left - 1
          || rect.right > interactionRect.right + 1
          || rect.top < interactionRect.top - 1
          || rect.bottom > interactionRect.bottom + 1;
      }),
      interactionControlVerticalOverflow: Math.max(
        0,
        ...interactionControls.map((element) => element.scrollHeight - element.clientHeight),
      ),
      interactionHorizontalOverflow: interaction.scrollWidth - interaction.clientWidth,
      interactionTop: interactionRect.top,
      sessionListHorizontalOverflow: sessionList.scrollWidth - sessionList.clientWidth,
      transcriptBottom: transcriptRect.bottom,
      transcriptHeight: transcriptRect.height,
      transcriptHorizontalOverflow: transcript.scrollWidth - transcript.clientWidth,
      viewportHeight: window.innerHeight,
    };
  });
  expect(geometry).not.toBeNull();
  expect(geometry).toMatchObject({
    composerHorizontalOverflow: 0,
    documentHorizontalOverflow: 0,
    interactionControlHorizontalOverflow: 0,
    interactionControlOutsideBounds: false,
    interactionControlVerticalOverflow: 0,
    interactionHorizontalOverflow: 0,
    sessionListHorizontalOverflow: 0,
    transcriptHorizontalOverflow: 0,
  });
  expect(geometry!.transcriptHeight).toBeGreaterThan(48);
  expect(geometry!.transcriptBottom).toBeLessThanOrEqual(geometry!.interactionTop + 1);
  expect(geometry!.interactionBottom).toBeLessThanOrEqual(geometry!.composerTop + 1);
  expect(geometry!.composerBottom).toBeLessThanOrEqual(geometry!.viewportHeight + 1);
}

const visualCases = [
  {
    interactions: [approvalFixture, questionFixture],
    name: 'desktop',
    snapshot: 'codex-session-desktop-1440x900.png',
    viewport: { height: 900, width: 1_440 },
  },
  {
    interactions: [questionFixture],
    name: 'narrow',
    snapshot: 'codex-session-narrow-900x800.png',
    viewport: { height: 800, width: 900 },
  },
] as const;

for (const visualCase of visualCases) {
  test(`Codex Session ${visualCase.name} workbench matches the reviewed visual baseline`, async ({
    page,
    request,
  }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    const interactionRequestUrls: string[] = [];
    const interactionResponses: Array<{
      body: unknown;
      status: number;
      url: string;
    }> = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('requestfailed', (browserRequest) => {
      failedRequests.push(
        `${browserRequest.url()} ${browserRequest.failure()?.errorText ?? 'request failed'}`,
      );
    });
    page.on('request', (browserRequest) => {
      const url = new URL(browserRequest.url());
      if (url.pathname.includes('/interactions')) {
        interactionRequestUrls.push(url.toString());
      }
    });
    page.on('response', async (browserResponse) => {
      const url = new URL(browserResponse.url());
      if (!url.pathname.includes('/interactions')) {
        return;
      }
      interactionResponses.push({
        body: await browserResponse.json(),
        status: browserResponse.status(),
        url: url.toString(),
      });
    });
    await bootstrapAuthenticatedSession(page, request);
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.setViewportSize(visualCase.viewport);
    await exposeCompletedCodexSessionActivity(page);
    await exposeCodexPendingInteractions(page, [...visualCase.interactions]);

    await page.goto('/#/app/code');
    await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
      timeout: 60_000,
    });
    await expandProjectSessions(page);

    const sessionRow = page.locator(`[data-agent-session-id="${codexSessionId}"]`);
    await sessionRow.locator(':scope > button[aria-label]').click();
    await expect(sessionRow).toHaveClass(/birdcoder-session-selected/u);

    const transcript = page.getByRole('region', { name: 'Conversation messages' });
    await expect(transcript.getByText(
      'Codex completed the provider-neutral file presentation.',
      { exact: true },
    )).toHaveCount(1);
    const processDisclosure = transcript.getByRole('button', {
      name: /Processed.*Show execution process/u,
    });
    if (await processDisclosure.count() > 0) {
      await processDisclosure.click();
    }
    const fileChanges = transcript.locator('[data-chat-turn-file-changes="true"]');
    await expect(fileChanges).toHaveCount(1);
    await fileChanges.locator('[data-chat-file-disclosure="true"]').click();
    await expect(fileChanges.locator('[data-chat-file-inline-diff="true"]')).toContainText(
      "applicationName = 'BirdCoder Codex'",
    );
    await fileChanges.scrollIntoViewIfNeeded();

    await expect.poll(
      () => interactionRequestUrls.join('\n'),
      { message: 'The selected Codex Session must request its canonical Interaction list.' },
    ).not.toBe('');
    expect(interactionRequestUrls[0]).toContain(
      `/agents/${codexAgentId}/sessions/${codexSessionId}/interactions`,
    );
    expect(new URL(interactionRequestUrls[0]).pathname).toBe(
      `/app/v3/api/ai/agents/${codexAgentId}/sessions/${codexSessionId}/interactions`,
    );
    await expect.poll(() => interactionResponses.length).toBeGreaterThan(0);
    expect(interactionResponses[0]).toMatchObject({
      body: {
        code: 0,
        data: {
          items: visualCase.interactions.map(({ interactionId, kind }) => ({
            interactionId,
            kind,
          })),
        },
      },
      status: 200,
    });
    expect(consoleErrors.filter((entry) => /interaction/iu.test(entry))).toEqual([]);

    const pendingInteractions = page.locator('[data-chat-pending-interactions="true"]');
    await expect(pendingInteractions).toHaveCount(1);
    await expect(pendingInteractions).toContainText('How should the Codex Session continue?');
    if (visualCase.name === 'desktop') {
      await expect(pendingInteractions).toContainText(
        'Approve the Codex visual parity file change.',
      );
      const approvalSurface = pendingInteractions.locator(
        '[data-codex-approval-surface="true"]',
      );
      await expect(approvalSurface).toHaveCount(1);
      const denyButton = approvalSurface.getByRole('button', { name: 'Deny', exact: true });
      const allowOnceButton = approvalSurface.getByRole('button', {
        name: 'Allow once',
        exact: true,
      });
      await expect(denyButton.locator('svg')).toHaveCount(0);
      await expect(allowOnceButton.locator('svg')).toHaveCount(0);
      await expect(approvalSurface.getByPlaceholder('Optional reason...')).toHaveCount(0);
      await expect(approvalSurface.getByRole('button', { name: 'Block' })).toHaveCount(0);
    }
    await expect(pendingInteractions.locator('[data-user-input-auto-resolution]')).toHaveCount(0);
    await expect(
      pendingInteractions.locator('[data-codex-composer-request-navigation]'),
    ).toHaveCount(0);
    const composer = page.locator(
      'textarea[placeholder="Ask anything or request changes..."]:visible',
    );
    await expect(composer).toBeEditable();
    await expect(composer).toHaveAttribute('rows', '1');

    await waitForStableVisualState(page);
    await assertVisualLayout(page);
    expect(failedRequests).toEqual([]);
    expect(consoleErrors).toEqual([]);
    await expect(page).toHaveScreenshot(visualCase.snapshot, {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.002,
      scale: 'css',
    });
  });
}
