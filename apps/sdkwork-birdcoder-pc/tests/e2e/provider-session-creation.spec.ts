import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;
const projectId = 'project.e2e-1';
const createdAt = '2026-07-26T10:00:00.000Z';

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

test('browser cloud providers fail closed before creating Agent Sessions without Sandbox placement', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  const sessionCreateBodies: Record<string, unknown>[] = [];
  const runtimeBindingBodies: Record<string, unknown>[] = [];
  const runtimeBindingAgentIds: string[] = [];
  const turnRequests: Array<{
    agentId: string;
    body: Record<string, unknown>;
    sessionId: string;
  }> = [];
  const deletedSessions: Array<{ agentId: string; sessionId: string }> = [];
  let failNextRuntimeBinding = false;
  const createSessionRecord = (sequence: number) => {
    const body = sessionCreateBodies[sequence - 1] ?? {};
    return {
      sessionId: `e2e-provider-created-${sequence}`,
      tenantId: '0',
      organizationId: '0',
      agentId: body.agentId,
      ownerUserId: '1',
      projectId,
      sessionKind: 'coding',
      entrySurface: 'pc',
      sourceModule: 'sdkwork-birdcoder',
      sourceContextKind: body.sourceContextKind,
      sourceContextId: body.sourceContextId,
      title: body.title,
      status: 'active',
      itemCount: '0',
      lastItemSequence: '0',
      totalInputTokens: '0',
      totalOutputTokens: '0',
      createdBy: '1',
      updatedBy: '1',
      version: '1',
      createdAt,
      updatedAt: createdAt,
    };
  };
  const resolveCreatedSessionSequence = (url: string): number => Number(
    /\/sessions\/e2e-provider-created-(?<sequence>\d+)(?:\/|$)/u.exec(
      new URL(url).pathname,
    )?.groups?.sequence ?? 0,
  );
  const createRuntimeBindingRecord = (sequence: number) => ({
    runtimeBindingId: `runtime-binding.provider-created-${sequence}`,
    tenantId: '0',
    organizationId: '0',
    sessionId: `e2e-provider-created-${sequence}`,
    ...(runtimeBindingBodies[sequence - 1] ?? {}),
    status: 'active',
    isCurrent: true,
    version: '1',
    createdAt,
    updatedAt: createdAt,
    activatedAt: createdAt,
  });

  await page.route(`**/app/v3/api/ai/projects/${projectId}/sessions`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    sessionCreateBodies.push(body);
    const sequence = sessionCreateBodies.length;
    await route.fulfill({
      json: {
        code: 0,
        data: createSessionRecord(sequence),
        traceId: `provider-session-create-${sequence}`,
      },
    });
  });
  await page.route(
    /\/app\/v3\/api\/ai\/projects\/project\.e2e-1\/sessions\/e2e-provider-created-\d+$/u,
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      const sequence = resolveCreatedSessionSequence(route.request().url());
      await route.fulfill({
        json: {
          code: 0,
          data: createSessionRecord(sequence),
          traceId: `provider-project-session-${sequence}`,
        },
      });
    },
  );
  await page.route(
    /\/app\/v3\/api\/ai\/agents\/[^/]+\/sessions\/e2e-provider-created-\d+$/u,
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      const sequence = resolveCreatedSessionSequence(route.request().url());
      await route.fulfill({
        json: {
          code: 0,
          data: createSessionRecord(sequence),
          traceId: `provider-agent-session-${sequence}`,
        },
      });
    },
  );
  await page.route(
    /\/app\/v3\/api\/ai\/agents\/[^/]+\/sessions\/e2e-provider-created-\d+\/items(?:\/synchronize)?(?:\?.*)?$/u,
    async (route) => {
      const requestUrl = new URL(route.request().url());
      const method = route.request().method();
      const isSynchronization = requestUrl.pathname.endsWith('/items/synchronize');
      if ((isSynchronization && method !== 'POST') || (!isSynchronization && method !== 'GET')) {
        await route.fallback();
        return;
      }
      const sequence = resolveCreatedSessionSequence(route.request().url());
      await route.fulfill({
        json: {
          code: 0,
          data: {
            items: [],
            pageInfo: {
              hasMore: false,
              mode: 'cursor',
              nextCursor: null,
              pageSize: 50,
            },
          },
          traceId: `provider-session-items-${sequence}`,
        },
      });
    },
  );
  await page.route(
    /\/app\/v3\/api\/ai\/agents\/[^/]+\/sessions\/e2e-provider-created-\d+\/interactions(?:\?.*)?$/u,
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      const sequence = resolveCreatedSessionSequence(route.request().url());
      await route.fulfill({
        json: {
          code: 0,
          data: {
            items: [],
            pageInfo: {
              hasMore: false,
              mode: 'offset',
              page: 1,
              pageSize: 200,
              totalItems: '0',
              totalPages: 0,
            },
          },
          traceId: `provider-session-interactions-${sequence}`,
        },
      });
    },
  );
  await page.route(
    '**/app/v3/api/ai/agents/*/sessions/*/runtime_bindings',
    async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      runtimeBindingBodies.push(body);
      const runtimeBindingMatch = /\/agents\/(?<agentId>[^/]+)\/sessions\/[^/]+\/runtime_bindings$/u.exec(
        new URL(route.request().url()).pathname,
      );
      runtimeBindingAgentIds.push(decodeURIComponent(runtimeBindingMatch?.groups?.agentId ?? ''));
      const sequence = runtimeBindingBodies.length;
      if (failNextRuntimeBinding) {
        failNextRuntimeBinding = false;
        await route.fulfill({
          status: 422,
          json: {
            code: 42200,
            message: 'Provider Runtime Binding is invalid.',
          },
        });
        return;
      }
      await route.fulfill({
        json: {
          code: 0,
          data: createRuntimeBindingRecord(sequence),
          traceId: `provider-host-binding-${sequence}`,
        },
      });
    },
  );
  await page.route(
    /\/app\/v3\/api\/ai\/agents\/[^/]+\/sessions\/e2e-provider-created-\d+\/runtime_bindings(?:\?.*)?$/u,
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      const sequence = resolveCreatedSessionSequence(route.request().url());
      await route.fulfill({
        json: {
          code: 0,
          data: {
            items: [createRuntimeBindingRecord(sequence)],
            pageInfo: {
              hasMore: false,
              mode: 'offset',
              page: 1,
              pageSize: 20,
              totalItems: '1',
              totalPages: 1,
            },
          },
          traceId: `provider-host-bindings-${sequence}`,
        },
      });
    },
  );
  await page.route(
    '**/app/v3/api/ai/agents/*/sessions/*/turns*',
    async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      const match = /\/agents\/(?<agentId>[^/]+)\/sessions\/(?<sessionId>[^/]+)\/turns$/u.exec(
        new URL(route.request().url()).pathname,
      );
      const agentId = decodeURIComponent(match?.groups?.agentId ?? '');
      const sessionId = decodeURIComponent(match?.groups?.sessionId ?? '');
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const sequence = turnRequests.length + 1;
      const completedAt = new Date(Date.parse(createdAt) + sequence * 1_000).toISOString();
      const turnId = String(body.turnId ?? `turn.e2e-provider-${sequence}`);
      const userItemId = `item.e2e-provider-${sequence}-user`;
      const assistantItemId = `item.e2e-provider-${sequence}-assistant`;
      const createdSessionSequence = Number(sessionId.match(/-(\d+)$/u)?.[1] ?? 0);
      const createdSessionBody = sessionCreateBodies[createdSessionSequence - 1] ?? {};
      turnRequests.push({ agentId, body, sessionId });

      const completion = {
        code: 0,
        data: {
          item: {
            session: {
              sessionId,
              tenantId: '0',
              organizationId: '0',
              agentId,
              ownerUserId: '1',
              projectId,
              sessionKind: 'coding',
              entrySurface: 'pc',
              sourceModule: 'sdkwork-birdcoder',
              sourceContextKind: createdSessionBody.sourceContextKind,
              sourceContextId: createdSessionBody.sourceContextId,
              title: createdSessionBody.title,
              status: 'active',
              itemCount: '2',
              lastItemSequence: '2',
              totalInputTokens: '0',
              totalOutputTokens: '6',
              createdBy: '1',
              updatedBy: '1',
              version: '2',
              createdAt,
              updatedAt: completedAt,
            },
            turn: {
              turnId,
              tenantId: '0',
              organizationId: '0',
              sessionId,
              agentId,
              ownerUserId: '1',
              runtimeBindingId: body.runtimeBindingId,
              clientRequestId: body.clientRequestId,
              idempotencyKey: body.idempotencyKey,
              payloadHash: body.payloadHash,
              requestItemId: userItemId,
              responseItemId: assistantItemId,
              turnMode: 'interactive',
              status: 'completed',
              requestedModelId: body.requestedModelId,
              modelId: body.requestedModelId,
              inputTokens: '0',
              outputTokens: '6',
              cachedTokens: '0',
              finishReason: 'stop',
              attemptCount: 1,
              maxAttempts: 1,
              availableAt: completedAt,
              fencingToken: '1',
              version: '1',
              createdAt: completedAt,
              updatedAt: completedAt,
              startedAt: completedAt,
              completedAt,
            },
            items: [
              {
                itemId: userItemId,
                tenantId: '0',
                organizationId: '0',
                sessionId,
                turnId,
                kind: 'user_input',
                sequence: '1',
                status: 'completed',
                content: body.content,
                contentType: 'text/plain',
                inputTokens: '0',
                outputTokens: '0',
                driveRefs: [],
                createdBy: '1',
                version: '1',
                createdAt: completedAt,
                updatedAt: completedAt,
                completedAt,
              },
              {
                itemId: assistantItemId,
                tenantId: '0',
                organizationId: '0',
                sessionId,
                turnId,
                kind: 'assistant_output',
                sequence: '2',
                status: 'completed',
                content: 'Provider selection verified.',
                contentType: 'text/plain',
                inputTokens: '0',
                outputTokens: '6',
                modelId: body.requestedModelId,
                driveRefs: [],
                createdBy: '1',
                version: '1',
                createdAt: completedAt,
                updatedAt: completedAt,
                completedAt,
              },
            ],
          },
        },
        traceId: `provider-turn-${sequence}`,
      };

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          `data: ${JSON.stringify({
            eventType: 'delta',
            index: 0,
            delta: 'Provider selection ',
          })}`,
          '',
          `data: ${JSON.stringify({
            eventType: 'delta',
            index: 1,
            delta: 'verified.',
          })}`,
          '',
          `data: ${JSON.stringify({
            eventType: 'completion',
            response: completion,
          })}`,
          '',
          '',
        ].join('\n'),
      });
    },
  );
  await page.route(
    /\/app\/v3\/api\/ai\/agents\/[^/]+\/sessions\/[^/?]+$/u,
    async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.fallback();
        return;
      }
      const match = /\/agents\/(?<agentId>[^/]+)\/sessions\/(?<sessionId>[^/]+)$/u.exec(
        new URL(route.request().url()).pathname,
      );
      deletedSessions.push({
        agentId: decodeURIComponent(match?.groups?.agentId ?? ''),
        sessionId: decodeURIComponent(match?.groups?.sessionId ?? ''),
      });
      await route.fulfill({ status: 204, body: '' });
    },
  );

  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  const expandProject = page.getByRole('button', { name: 'Expand E2E Project' });
  const collapseProject = page.getByRole('button', { name: 'Collapse E2E Project' });
  await expect.poll(async () => (
    await expandProject.count() > 0 || await collapseProject.count() > 0
  ), { timeout: 60_000 }).toBe(true);
  if (await expandProject.count() > 0) {
    await expandProject.click();
  }
  await expect(collapseProject).toBeVisible();

  const providers = [
    {
      agentId: 'agent.intelligence.claude-code',
      menuName: /Claude Code.*Claude Sonnet 4\.5/iu,
      modelId: 'claude-sonnet-4-5',
      providerBindingId: 'claude-code',
      providerId: 'anthropic',
    },
    {
      agentId: 'agent.intelligence.codex',
      menuName: /Codex.*GPT-5 Codex/iu,
      modelId: 'gpt-5-codex',
      providerBindingId: 'codex',
      providerId: 'openai',
    },
    {
      agentId: 'agent.intelligence.opencode',
      menuName: /Opencode.*Automatic/iu,
      modelId: 'auto',
      providerBindingId: 'opencode',
      providerId: 'opencode',
    },
  ] as const;

  const providerMenuButton = page.locator('[data-sidebar-new-session-trigger="true"]');
  const providerMenu = page.getByRole('menu', { name: 'New task' });
  const newSessionProviderSelector = page.getByTestId(
    'universal-chat-new-session-provider-selector',
  );
  const newSessionComposer = page.locator('[data-new-session-composer="true"]');

  for (const provider of providers) {
    await providerMenuButton.hover();
    await expect(providerMenu).toBeVisible();
    await providerMenu.getByRole('menuitemradio', { name: provider.menuName }).click();
    await expect(newSessionProviderSelector).toHaveAccessibleName(
      `Current provider: ${provider.providerBindingId === 'claude-code'
        ? 'Claude Code'
        : provider.providerBindingId === 'codex'
          ? 'Codex'
          : 'Opencode'}`,
    );

    expect(sessionCreateBodies).toHaveLength(0);
    expect(runtimeBindingBodies).toHaveLength(0);
  }

  await providerMenuButton.hover();
  await expect(providerMenu).toBeVisible();
  await providerMenu.getByRole('menuitemradio', { name: providers[2].menuName }).click();
  const newSessionContext = page.locator('[data-new-session-context="true"]');
  const [newSessionContextBox, newSessionProviderSelectorBox, newSessionTextareaBox] =
    await Promise.all([
      newSessionContext.boundingBox(),
      newSessionProviderSelector.boundingBox(),
      newSessionComposer.locator('textarea').boundingBox(),
    ]);
  expect(newSessionContextBox).not.toBeNull();
  expect(newSessionProviderSelectorBox).not.toBeNull();
  expect(newSessionTextareaBox).not.toBeNull();
  expect(
    Math.abs(
      (newSessionContextBox?.x ?? 0) + (newSessionContextBox?.width ?? 0)
        - (newSessionProviderSelectorBox?.x ?? 0)
        - (newSessionProviderSelectorBox?.width ?? 0),
    ),
  ).toBeLessThanOrEqual(1);
  expect(
    (newSessionProviderSelectorBox?.y ?? 0) + (newSessionProviderSelectorBox?.height ?? 0),
  ).toBeLessThanOrEqual(newSessionTextareaBox?.y ?? 0);
  const providerSelectorVisualState = await newSessionProviderSelector.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderWidths: [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ],
      text: element.textContent?.trim() ?? '',
    };
  });
  expect(providerSelectorVisualState).toMatchObject({
    backgroundColor: 'rgba(0, 0, 0, 0)',
    borderWidths: ['0px', '0px', '0px', '0px'],
  });
  expect(providerSelectorVisualState.text).not.toContain('Provider');
  await expect(newSessionProviderSelector).toHaveAccessibleName(
    'Current provider: Opencode',
  );
  await newSessionProviderSelector.click();
  const newSessionProviderMenu = page.getByRole('menu', { name: 'Select provider' });
  await expect(newSessionProviderMenu).toBeVisible();
  const providerMenuVisualState = await newSessionProviderMenu.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      borderWidths: [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ],
      text: element.textContent?.trim() ?? '',
    };
  });
  expect(providerMenuVisualState.borderWidths).toEqual(['0px', '0px', '0px', '0px']);
  expect(providerMenuVisualState.text).not.toContain('Select provider');
  await newSessionProviderMenu.getByRole('menuitemradio', {
    name: 'Codex, GPT-5 Codex',
  }).click();
  await expect(newSessionProviderSelector).toHaveAccessibleName('Current provider: Codex');

  await page.setViewportSize({ height: 800, width: 680 });
  await newSessionProviderSelector.click();
  await expect(newSessionProviderMenu).toBeVisible();
  const narrowProviderMenuBox = await newSessionProviderMenu.boundingBox();
  expect(narrowProviderMenuBox).not.toBeNull();
  expect(narrowProviderMenuBox?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect(
    (narrowProviderMenuBox?.x ?? 0) + (narrowProviderMenuBox?.width ?? 0),
  ).toBeLessThanOrEqual(680);
  expect(
    (narrowProviderMenuBox?.y ?? 0) + (narrowProviderMenuBox?.height ?? 0),
  ).toBeLessThanOrEqual(800);
  await page.keyboard.press('Escape');
  await expect(newSessionProviderMenu).toBeHidden();
  await page.setViewportSize({ height: 720, width: 1280 });
  await newSessionComposer.locator('textarea').fill('Verify the selected provider');
  await newSessionComposer.locator('button[title="Send message"]').click();
  await expect(page.getByText(
    'Cloud execution is unavailable until Agents can prove a ready Sandbox placement.',
    { exact: true },
  ).first()).toBeVisible();
  expect(sessionCreateBodies).toHaveLength(0);
  expect(runtimeBindingBodies).toHaveLength(0);
  expect(runtimeBindingAgentIds).toHaveLength(0);
  expect(turnRequests).toHaveLength(0);
  expect(deletedSessions).toHaveLength(0);
});
