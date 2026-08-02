import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;
const codexAgentId = 'agent.intelligence.codex';
const codexSessionId = 'e2e-codex-session';
const approvalInteractionId = 'interaction.e2e-codex-approval';
const typedApprovalInteractionId = 'interaction.e2e-codex-typed-approval';
const typedQuestionInteractionId = 'interaction.e2e-codex-typed-question';
const questionInteractionId = 'interaction.e2e-codex-question';

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

interface AuthenticatedSessionFixture {
  accessToken: string;
  expiresAt: string;
  [key: string]: unknown;
}

async function bootstrapAuthenticatedSession(
  page: Page,
  request: APIRequestContext,
): Promise<AuthenticatedSessionFixture> {
  const response = await request.post(`${mockApiBaseUrl}/app/v3/api/auth/sessions`, {
    data: {
      account: 'e2e@test.sdkwork.local',
      password: 'e2e-password',
    },
  });
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { data: AuthenticatedSessionFixture };
  await page.addInitScript((session) => {
    localStorage.setItem('sdkwork.birdcoder.appSession.v1', JSON.stringify({
      ...session,
      expiresAt: Math.floor(Date.parse(session.expiresAt) / 1_000),
      storedAt: Math.floor(Date.now() / 1_000),
    }));
  }, payload.data);
  return payload.data;
}

async function createPendingInteraction(
  request: APIRequestContext,
  accessToken: string,
  data: Record<string, unknown>,
): Promise<void> {
  const response = await request.post(
    `${mockApiBaseUrl}/app/v3/api/ai/agents/${codexAgentId}`
      + `/sessions/${codexSessionId}/interactions`,
    {
      data,
      headers: { 'Access-Token': accessToken },
    },
  );
  const responseBody = await response.text();
  expect(
    response.status(),
    `Interaction creation ${response.url()} returned ${response.status()}: ${responseBody}`,
  ).toBe(201);
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

function matchesInteractionPath(
  responseUrl: string,
  interactionId: string,
  action: 'claim' | 'approve' | 'answer' | 'resolve',
): boolean {
  return decodeURIComponent(new URL(responseUrl).pathname).endsWith(
    `/sessions/${codexSessionId}/interactions/${interactionId}/${action}`,
  );
}

test('Codex canonical Session claims and resolves pending interactions', async ({
  page,
  request,
}) => {
  const authenticatedSession = await bootstrapAuthenticatedSession(page, request);
  await Promise.all([
    createPendingInteraction(request, authenticatedSession.accessToken, {
      interactionId: approvalInteractionId,
      kind: 'approval',
      prompt: 'Allow Codex to run the focused verification command?',
      providerInteractionId: 'provider-interaction.codex-approval-e2e',
      requestedAt: '2026-01-01T00:21:02.000Z',
      runtimeBindingId: `runtime-binding.${codexSessionId}`,
      turnId: 'turn.e2e-codex-legacy-approval',
    }),
    createPendingInteraction(request, authenticatedSession.accessToken, {
      interactionId: questionInteractionId,
      kind: 'user_question',
      options: [
        { label: 'Use strict mode', value: 'strict' },
        { label: 'Use compatibility mode', value: 'compatibility' },
      ],
      prompt: 'Which verification mode should Codex use?',
      providerInteractionId: 'provider-interaction.codex-question-e2e',
      requestedAt: '2026-01-01T00:21:00.000Z',
      runtimeBindingId: `runtime-binding.${codexSessionId}`,
      turnId: 'turn.e2e-codex-legacy-question',
    }),
    createPendingInteraction(request, authenticatedSession.accessToken, {
      interactionId: typedApprovalInteractionId,
      kind: 'approval',
      prompt: 'Allow Codex to run the typed verification command?',
      providerInteractionId: 'provider-interaction.codex-typed-approval-e2e',
      requestedAt: '2026-01-01T00:21:03.000Z',
      request: {
        schemaVersion: 1,
        category: 'approval',
        kind: 'command_execution',
        allowedActions: [
          'accept',
          'accept_with_exec_policy_amendment',
          'decline',
        ],
        data: {
          command: 'pnpm test',
          cwd: 'E:\\sdkwork-space\\sdkwork-birdcoder',
          message: 'Allow Codex to run the typed verification command?',
          proposedExecPolicyAmendment: {
            commandPrefix: ['pnpm', 'test'],
          },
        },
      },
      runtimeBindingId: `runtime-binding.${codexSessionId}`,
      turnId: 'turn.e2e-codex-typed-approval',
    }),
    createPendingInteraction(request, authenticatedSession.accessToken, {
      interactionId: typedQuestionInteractionId,
      kind: 'user_question',
      prompt: 'Which typed verification strategy should Codex use?',
      providerInteractionId: 'provider-interaction.codex-typed-question-e2e',
      requestedAt: '2026-01-01T00:21:01.000Z',
      request: {
        schemaVersion: 1,
        category: 'user_input',
        kind: 'question_set',
        allowedActions: ['submit', 'dismiss'],
        data: {
          questions: [{
            id: 'verification_strategy',
            header: 'Strategy',
            prompt: 'Choose the typed verification strategy',
            allowOther: true,
            secret: false,
            options: [
              { label: 'Focused', description: 'Run only focused checks.' },
              { label: 'Complete', description: 'Run all relevant checks.' },
            ],
          }],
        },
      },
      runtimeBindingId: `runtime-binding.${codexSessionId}`,
      turnId: 'turn.e2e-codex-typed-question',
    }),
  ]);
  await exposeCompletedCodexSessionActivity(page);
  await page.setViewportSize({ width: 1_440, height: 900 });

  const pendingListResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'GET'
      && url.pathname.endsWith(`/sessions/${codexSessionId}/interactions`)
      && url.searchParams.get('page') === '1'
      && url.searchParams.get('page_size') === '200'
      && url.searchParams.get('status') === 'pending';
  });
  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  await expandProjectSessions(page);

  const sessionRow = page.locator(`[data-agent-session-id="${codexSessionId}"]`);
  const sessionButton = sessionRow.locator(':scope > button[aria-label]');
  if (!await sessionRow.evaluate((element) => (
    element.classList.contains('birdcoder-session-selected')
  ))) {
    await sessionButton.click();
  }
  expect((await pendingListResponse).ok()).toBe(true);
  await expect(sessionRow).toHaveClass(/birdcoder-session-selected/u);

  const approvalPrompt = page.getByText(
    'Allow Codex to run the focused verification command?',
    { exact: true },
  );
  const typedApprovalPrompt = page.getByText(
    'Allow Codex to run the typed verification command?',
    { exact: true },
  );
  const questionPrompt = page.getByRole('paragraph').filter({
    hasText: 'Which verification mode should Codex use?',
  });
  const typedQuestionPrompt = page.locator(
    `[data-codex-interaction-id="${typedQuestionInteractionId}"]`,
  );
  await expect(approvalPrompt).toHaveCount(0);
  await expect(typedApprovalPrompt).toBeVisible();
  await expect(questionPrompt).toHaveCount(0);
  await expect(typedQuestionPrompt).toHaveCount(0);

  const typedApprovalClaimResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && matchesInteractionPath(response.url(), typedApprovalInteractionId, 'claim')
  ));
  const typedApprovalResolveResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && matchesInteractionPath(response.url(), typedApprovalInteractionId, 'resolve')
  ));
  const typedApprovalSurface = typedApprovalPrompt.locator(
    'xpath=ancestor::*[@data-codex-approval-surface][1]',
  );
  await typedApprovalSurface.getByRole('button', { name: 'Approval options' }).click();
  await page.getByRole('menuitem', { name: 'Allow similar commands' }).click();

  expect((await typedApprovalClaimResponse).ok()).toBe(true);
  const resolvedTypedApproval = await typedApprovalResolveResponse;
  expect(resolvedTypedApproval.ok()).toBe(true);
  expect(resolvedTypedApproval.request().postDataJSON()).toMatchObject({
    resolution: {
      action: 'accept_with_exec_policy_amendment',
      execPolicyAmendment: {
        commandPrefix: ['pnpm', 'test'],
      },
    },
  });
  await expect(typedApprovalPrompt).toHaveCount(0);
  await expect(approvalPrompt).toBeVisible();

  const approvalClaimResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && matchesInteractionPath(response.url(), approvalInteractionId, 'claim')
  ));
  const approvalResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && matchesInteractionPath(response.url(), approvalInteractionId, 'approve')
  ));
  const approvalSurface = approvalPrompt.locator(
    'xpath=ancestor::*[@data-codex-approval-surface][1]',
  );
  const approveButton = approvalSurface.getByRole('button', {
    name: 'Allow once',
    exact: true,
  });
  await expect(approveButton).toHaveCount(1);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  await page.keyboard.press('Enter');

  const claimedApproval = await approvalClaimResponse;
  expect(claimedApproval.ok()).toBe(true);
  expect(claimedApproval.request().postDataJSON()).toMatchObject({
    claimOwner: 'e2e-user-1',
    expectedVersion: '1',
    leaseSeconds: 60,
    requestedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/u),
  });
  const resolvedApproval = await approvalResponse;
  expect(resolvedApproval.ok()).toBe(true);
  expect(resolvedApproval.request().postDataJSON()).toMatchObject({
    approved: true,
    claimToken: expect.stringMatching(/^claim\.e2e-/u),
    expectedVersion: '2',
    fencingToken: '1',
    requestedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/u),
  });
  await expect(approvalPrompt).toHaveCount(0);
  await expect(typedQuestionPrompt).toBeVisible();

  const typedQuestionClaimResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && matchesInteractionPath(response.url(), typedQuestionInteractionId, 'claim')
  ));
  const typedQuestionResolveResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && matchesInteractionPath(response.url(), typedQuestionInteractionId, 'resolve')
  ));
  const typedQuestionSurface = typedQuestionPrompt;
  await expect(typedQuestionSurface.getByRole('button', { name: 'Submit' })).toHaveCount(0);
  await typedQuestionSurface.getByRole('radio', { name: /Complete/u }).click();

  expect((await typedQuestionClaimResponse).ok()).toBe(true);
  const resolvedTypedQuestion = await typedQuestionResolveResponse;
  expect(resolvedTypedQuestion.ok()).toBe(true);
  expect(resolvedTypedQuestion.request().postDataJSON()).toMatchObject({
    resolution: {
      action: 'submit',
      answers: {
        verification_strategy: ['Complete'],
      },
    },
  });
  await expect(typedQuestionPrompt).toHaveCount(0);
  await expect(questionPrompt).toBeVisible();

  const questionClaimResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && matchesInteractionPath(response.url(), questionInteractionId, 'claim')
  ));
  const answerResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && matchesInteractionPath(response.url(), questionInteractionId, 'answer')
  ));
  const strictModeButton = page.getByRole('button', {
    name: 'Use strict mode',
    exact: true,
  });
  await expect(strictModeButton).toHaveCount(1);
  await strictModeButton.click();

  const claimedQuestion = await questionClaimResponse;
  expect(claimedQuestion.ok()).toBe(true);
  expect(claimedQuestion.request().postDataJSON()).toMatchObject({
    claimOwner: 'e2e-user-1',
    expectedVersion: '1',
    leaseSeconds: 60,
  });
  const answeredQuestion = await answerResponse;
  expect(answeredQuestion.ok()).toBe(true);
  expect(answeredQuestion.request().postDataJSON()).toMatchObject({
    answer: 'strict',
    claimToken: expect.stringMatching(/^claim\.e2e-/u),
    expectedVersion: '2',
    fencingToken: '1',
    rejected: false,
    selectedOptionValue: 'strict',
  });

  await expect(questionPrompt).toHaveCount(0);
  await expect(page.getByText('Waiting on you', { exact: true })).toHaveCount(0);
  const composer = page.locator(
    'textarea[placeholder="Ask anything or request changes..."]:visible',
  );
  await expect(composer).toBeEnabled();
});
