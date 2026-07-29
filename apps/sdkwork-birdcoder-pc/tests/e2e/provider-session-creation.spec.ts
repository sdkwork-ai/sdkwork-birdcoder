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

test('selected code providers create their own Agent Sessions without a runtime location', async ({
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
        data: {
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
        },
        traceId: `provider-session-create-${sequence}`,
      },
    });
  });
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
          data: {
            runtimeBindingId: `runtime-binding.provider-created-${sequence}`,
            tenantId: '0',
            organizationId: '0',
            sessionId: `e2e-provider-created-${sequence}`,
            ...body,
            status: 'active',
            isCurrent: true,
            version: '1',
            createdAt,
            updatedAt: createdAt,
            activatedAt: createdAt,
          },
          traceId: `provider-runtime-binding-${sequence}`,
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
      agentId: 'agent.claude-code',
      menuName: /Claude Code.*Claude Sonnet 4\.5/iu,
      modelId: 'claude-sonnet-4-5',
      providerBindingId: 'claude-code',
      providerId: 'anthropic',
    },
    {
      agentId: 'agent.codex',
      menuName: /Codex.*GPT-5 Codex/iu,
      modelId: 'gpt-5-codex',
      providerBindingId: 'codex',
      providerId: 'openai',
    },
    {
      agentId: 'agent.opencode',
      menuName: /Opencode.*Automatic/iu,
      modelId: 'auto',
      providerBindingId: 'opencode',
      providerId: 'opencode',
    },
  ] as const;

  const providerMenuButton = page.locator('[data-sidebar-new-session-trigger="true"]');
  const providerMenu = page.getByRole('menu', { name: 'New task' });

  for (const [index, provider] of providers.entries()) {
    await providerMenuButton.hover();
    await expect(providerMenu).toBeVisible();
    await providerMenu.getByRole('menuitemradio', { name: provider.menuName }).click();
    await expect.poll(() => runtimeBindingBodies.length).toBe(index + 1);

    expect(sessionCreateBodies[index]).toMatchObject({
      agentId: provider.agentId,
    });
    expect(runtimeBindingBodies[index]).toMatchObject({
      hostMode: 'web',
      transportKind: 'sdk-stream',
      modelId: provider.modelId,
      providerBindingId: provider.providerBindingId,
      providerId: provider.providerId,
    });
    expect(runtimeBindingAgentIds[index]).toBe(provider.agentId);
    expect(runtimeBindingBodies[index]).not.toHaveProperty('runtimeLocationId');
  }

  const newSessionProviderSelector = page.getByTestId(
    'universal-chat-new-session-provider-selector',
  );
  const newSessionComposer = page.locator('[data-new-session-composer="true"]');
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
  const providerTurnResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'POST'
      && url.pathname.endsWith('/e2e-provider-created-4/turns');
  });
  await newSessionComposer.locator('button[title="Send message"]').click();
  const submittedProviderTurnResponse = await providerTurnResponse;
  expect(
    submittedProviderTurnResponse.status(),
    await submittedProviderTurnResponse.text(),
  ).toBe(200);
  expect(new URL(submittedProviderTurnResponse.url()).searchParams.get('stream')).toBe('true');
  await expect.poll(() => runtimeBindingBodies.length).toBe(4);
  expect(sessionCreateBodies[3]).toMatchObject({ agentId: providers[1].agentId });
  expect(runtimeBindingBodies[3]).toMatchObject({
    modelId: providers[1].modelId,
    providerBindingId: providers[1].providerBindingId,
    providerId: providers[1].providerId,
  });
  expect(turnRequests).toHaveLength(1);
  expect(turnRequests[0]).toMatchObject({
    agentId: providers[1].agentId,
    body: {
      content: 'Verify the selected provider',
      requestedModelId: providers[1].modelId,
      runtimeBindingId: runtimeBindingBodies[3].runtimeBindingId,
      turnId: expect.stringMatching(/^turn\./u),
    },
    sessionId: 'e2e-provider-created-4',
  });
  await expect(page.getByText('Verify the selected provider', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Provider selection verified.', { exact: true })).toHaveCount(1);

  failNextRuntimeBinding = true;
  await providerMenuButton.hover();
  await providerMenu.getByRole('menuitemradio', {
    name: providers[1].menuName,
  }).click();

  await expect.poll(() => deletedSessions.length).toBe(1);
  expect(deletedSessions).toEqual([{
    agentId: providers[1].agentId,
    sessionId: 'e2e-provider-created-5',
  }]);
});
