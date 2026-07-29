import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;

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

async function disableApproveForMeMode(page: Page): Promise<void> {
  await page.route('**/app/v3/api/ai/code_engines', async (route) => {
    const response = await route.fetch();
    const payload = await response.json() as {
      data: {
        item: {
          engines: Array<{
            engineKey: string;
            accessModes: Array<{
              modeId: string;
              enabled: boolean;
              disabledReason?: string;
            }>;
          }>;
        };
      };
    };
    const codex = payload.data.item.engines.find((engine) => engine.engineKey === 'codex');
    const approveForMe = codex?.accessModes.find((mode) => mode.modeId === 'approve_for_me');
    if (approveForMe) {
      approveForMe.enabled = false;
      approveForMe.disabledReason = 'Temporarily disabled by host policy';
    }
    await route.fulfill({ response, json: payload });
  });
}

async function expectComposerActionPanelToFloat(page: Page): Promise<void> {
  const composerChrome = page.locator('[data-chat-composer-chrome="true"]:visible');
  const addAttachmentButton = page.locator('button[title="Add attachment"]:visible');
  await expect(composerChrome).toBeVisible();
  await expect(addAttachmentButton).toBeVisible();

  const composerBoxBeforeOpen = await composerChrome.boundingBox();
  expect(composerBoxBeforeOpen).not.toBeNull();
  await addAttachmentButton.click();

  const actionPanel = page.locator('[data-testid="composer-action-panel"]:visible');
  const universalChatRoot = page.locator('[data-universal-chat-root="true"]:visible');
  await expect(actionPanel).toBeVisible();
  await expect.poll(async () => {
    const actionPanelBox = await actionPanel.boundingBox();
    const universalChatRootBox = await universalChatRoot.boundingBox();
    if (!actionPanelBox || !universalChatRootBox) {
      return Number.NEGATIVE_INFINITY;
    }
    return actionPanelBox.y - universalChatRootBox.y;
  }).toBeGreaterThanOrEqual(0);
  const composerBoxAfterOpen = await composerChrome.boundingBox();
  const actionPanelBox = await actionPanel.boundingBox();
  const universalChatRootBox = await universalChatRoot.boundingBox();
  expect(composerBoxAfterOpen).not.toBeNull();
  expect(actionPanelBox).not.toBeNull();
  expect(universalChatRootBox).not.toBeNull();
  expect(composerBoxAfterOpen!.x).toBeCloseTo(composerBoxBeforeOpen!.x, 1);
  expect(composerBoxAfterOpen!.y).toBeCloseTo(composerBoxBeforeOpen!.y, 1);
  expect(composerBoxAfterOpen!.width).toBeCloseTo(composerBoxBeforeOpen!.width, 1);
  expect(composerBoxAfterOpen!.height).toBeCloseTo(composerBoxBeforeOpen!.height, 1);
  expect(actionPanelBox!.x).toBeCloseTo(composerBoxAfterOpen!.x, 1);
  expect(actionPanelBox!.width).toBeCloseTo(composerBoxAfterOpen!.width, 1);
  expect(actionPanelBox!.y + actionPanelBox!.height).toBeLessThanOrEqual(
    composerBoxAfterOpen!.y,
  );

  const viewport = page.viewportSize();
  const viewportWidth = viewport?.width;
  const viewportHeight = viewport?.height;
  expect(viewportWidth).toBeDefined();
  expect(viewportHeight).toBeDefined();
  expect(actionPanelBox!.x).toBeGreaterThanOrEqual(0);
  expect(actionPanelBox!.x + actionPanelBox!.width).toBeLessThanOrEqual(viewportWidth!);
  expect(actionPanelBox!.y).toBeGreaterThanOrEqual(0);
  expect(actionPanelBox!.y + actionPanelBox!.height).toBeLessThanOrEqual(viewportHeight!);
  expect(actionPanelBox!.y).toBeGreaterThanOrEqual(universalChatRootBox!.y);

  await page.keyboard.press('Escape');
  await expect(actionPanel).toHaveCount(0);
  await expect(addAttachmentButton).toBeFocused();
}

async function installAccessModeSession(page: Page): Promise<void> {
  const sessionId = 'session.e2e-access-mode';
  let agentId = 'agent.intelligence.codex';
  let runtimeBinding: Record<string, unknown> | null = null;
  const createSession = () => ({
    sessionId,
    tenantId: '0',
    organizationId: '0',
    agentId,
    ownerUserId: 'e2e-user-1',
    projectId: 'project.e2e-1',
    sessionKind: 'coding',
    entrySurface: 'pc',
    sourceModule: 'sdkwork-birdcoder',
    sourceContextKind: 'coding-project',
    sourceContextId: 'project.e2e-1',
    title: 'New task',
    status: 'active',
    itemCount: '0',
    lastItemSequence: '0',
    totalInputTokens: '0',
    totalOutputTokens: '0',
    createdBy: 'e2e-user-1',
    updatedBy: 'e2e-user-1',
    version: '1',
    createdAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
  });

  await page.route('**/app/v3/api/ai/projects/project.e2e-1/sessions', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    agentId = String(body.agentId ?? agentId);
    await route.fulfill({
      json: {
        code: 0,
        data: { item: createSession() },
        traceId: 'composer-access-mode-session-create',
      },
    });
  });

  await page.route(
    `**/app/v3/api/ai/agents/*/sessions/${sessionId}/runtime_bindings`,
    async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      runtimeBinding = {
        runtimeBindingId: 'runtime-binding.e2e-access-mode',
        tenantId: '0',
        organizationId: '0',
        sessionId,
        ...body,
        status: 'active',
        isCurrent: true,
        version: '1',
        createdAt: '2026-01-03T00:00:00.000Z',
        updatedAt: '2026-01-03T00:00:00.000Z',
        activatedAt: '2026-01-03T00:00:00.000Z',
      };
      await route.fulfill({
        json: {
          code: 0,
          data: { item: runtimeBinding },
          traceId: 'composer-access-mode-runtime-binding-create',
        },
      });
    },
  );

  await page.route(
    new RegExp(
      `/app/v3/api/ai/agents/[^/]+/sessions/${sessionId}/(?:checkpoints|interactions|items|runtime_bindings|turns)(?:\\?.*)?$`,
      'u',
    ),
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      const isRuntimeBindingRequest = new URL(route.request().url()).pathname.endsWith(
        '/runtime_bindings',
      );
      const requestUrl = new URL(route.request().url());
      const page = Number(requestUrl.searchParams.get('page') ?? 1);
      const pageSize = Number(requestUrl.searchParams.get('page_size') ?? 20);
      const items = isRuntimeBindingRequest && runtimeBinding ? [runtimeBinding] : [];
      await route.fulfill({
        json: {
          code: 0,
          data: {
            items,
            pageInfo: {
              hasMore: false,
              mode: 'offset',
              page,
              pageSize,
              totalItems: String(items.length),
              totalPages: items.length > 0 ? 1 : 0,
            },
          },
          traceId: 'composer-access-mode-session-resources',
        },
      });
    },
  );

  await page.route(`**/app/v3/api/ai/agents/*/sessions/${sessionId}`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      json: {
        code: 0,
        data: { item: createSession() },
        traceId: 'composer-access-mode-session-detail',
      },
    });
  });
}

test('composer access mode selects full access and snapshots it into the turn', async ({
  page,
  request,
}, testInfo) => {
  await bootstrapAuthenticatedSession(page, request);
  await disableApproveForMeMode(page);
  await installAccessModeSession(page);
  await page.setViewportSize({ width: 1_280, height: 760 });
  await page.goto('/#/app/code');

  const newTaskButton = page.locator('[data-sidebar-new-session-trigger="true"]');
  await expect(newTaskButton).toBeVisible({ timeout: 60_000 });
  await newTaskButton.hover();
  const providerMenu = page.locator('[data-sidebar-new-session-menu="true"]');
  const codexOption = providerMenu.getByRole('menuitemradio').filter({ hasText: 'Codex' });
  await expect(providerMenu).toBeVisible();
  await expect(codexOption).toHaveCount(1);
  await codexOption.click();

  const accessModeTrigger = page.locator(
    '[data-testid="composer-access-mode-trigger"]:visible',
  );
  await expect(accessModeTrigger).toBeVisible();
  await expect(accessModeTrigger).toHaveAttribute('data-access-mode-id', 'ask_for_approval');
  await expect(accessModeTrigger).toHaveAccessibleName('Access mode: Ask for approval');
  expect(await accessModeTrigger.evaluate((element) => (
    element.parentElement?.previousElementSibling?.querySelector('.lucide-plus') !== null
  ))).toBe(true);

  await accessModeTrigger.click();
  const accessModeMenu = page.locator('[data-testid="composer-access-mode-menu"]:visible');
  const approveForMeMode = accessModeMenu.locator(
    '[data-access-mode-option="approve_for_me"]',
  );
  const fullAccessMode = accessModeMenu.locator('[data-access-mode-option="full_access"]');
  await expect(accessModeMenu).toBeVisible();
  await expect(approveForMeMode).toBeDisabled();
  await expect(approveForMeMode).toHaveAttribute(
    'title',
    'Temporarily disabled by host policy',
  );

  await page.keyboard.press('Escape');
  await expect(accessModeMenu).toHaveCount(0);
  await expect(accessModeTrigger).toBeFocused();

  await accessModeTrigger.click();
  await fullAccessMode.click();
  await expect(accessModeMenu).toHaveCount(0);
  await expect(accessModeTrigger).toHaveAttribute('data-access-mode-id', 'full_access');
  await expect(accessModeTrigger).toHaveAccessibleName('Access mode: Full access');

  await expectComposerActionPanelToFloat(page);

  await page.setViewportSize({ width: 520, height: 640 });
  await accessModeTrigger.click();
  const menuBox = await accessModeMenu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox?.x).toBeGreaterThanOrEqual(0);
  expect((menuBox?.x ?? 0) + (menuBox?.width ?? 0)).toBeLessThanOrEqual(520);
  expect(menuBox?.y).toBeGreaterThanOrEqual(0);
  expect((menuBox?.y ?? 0) + (menuBox?.height ?? 0)).toBeLessThanOrEqual(640);
  await page.screenshot({
    path: testInfo.outputPath('composer-access-mode-narrow.png'),
    fullPage: true,
  });
  await page.keyboard.press('Escape');

  await expectComposerActionPanelToFloat(page);

  const message = `E2E full access verification ${Date.now()}`;
  const composer = page.locator('textarea[placeholder="Ask anything or request changes..."]:visible');
  await composer.fill(message);
  const turnRequest = page.waitForRequest((candidate) => (
    candidate.method() === 'POST'
      && new URL(candidate.url()).pathname.endsWith('/turns')
  ));
  await page.locator('button[title="Send message"]:visible').click();
  const submittedTurn = await turnRequest;
  expect(submittedTurn.postDataJSON()).toMatchObject({
    accessModeId: 'full_access',
    content: message,
    requestedModelId: 'gpt-5-codex',
  });
});
