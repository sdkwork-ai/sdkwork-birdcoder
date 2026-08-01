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

async function expectComposerFooterControlsNotToOverlap(page: Page): Promise<void> {
  const controls = await page.locator(
    '[data-testid="codex-composer-footer"]:visible',
  ).evaluate((footer) => [...footer.querySelectorAll<HTMLElement>('button')]
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        height: rect.height,
        left: rect.left,
        right: rect.right,
        width: rect.width,
      };
    })
    .filter((rect) => rect.height > 0 && rect.width > 0));

  expect(controls).toHaveLength(5);
  for (let index = 1; index < controls.length; index += 1) {
    expect(controls[index]!.left).toBeGreaterThanOrEqual(
      controls[index - 1]!.right - 0.5,
    );
  }
  expect(controls[0]!.width).toBeGreaterThanOrEqual(27.5);
  expect(controls[controls.length - 2]!.width).toBeGreaterThanOrEqual(31.5);
  expect(controls[controls.length - 1]!.width).toBeGreaterThanOrEqual(31.5);
}

async function installIdleCodexSessionActivity(page: Page): Promise<void> {
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

test('composer access mode selects full access and snapshots it into the turn', async ({
  page,
  request,
}, testInfo) => {
  await bootstrapAuthenticatedSession(page, request);
  await disableApproveForMeMode(page);
  await installIdleCodexSessionActivity(page);
  await page.route(/\/e2e-codex-session\/turns(?:\?.*)?$/u, async (route) => {
    if (route.request().method() === 'POST') {
      await route.abort('blockedbyclient');
      return;
    }
    await route.fallback();
  });
  await page.setViewportSize({ width: 1_280, height: 760 });
  await page.goto('/#/app/code');

  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  await expandProjectSessions(page);
  await page.locator('.project-explorer-scroll-region').last()
    .locator('[data-agent-session-id="e2e-codex-session"]')
    .locator(':scope > button[aria-label]')
    .click();

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

  await page.setViewportSize({ width: 390, height: 844 });
  await expectComposerFooterControlsNotToOverlap(page);
  await accessModeTrigger.click();
  const menuBox = await accessModeMenu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox?.x).toBeGreaterThanOrEqual(0);
  expect((menuBox?.x ?? 0) + (menuBox?.width ?? 0)).toBeLessThanOrEqual(390);
  expect(menuBox?.y).toBeGreaterThanOrEqual(0);
  expect((menuBox?.y ?? 0) + (menuBox?.height ?? 0)).toBeLessThanOrEqual(844);
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
      && new URL(candidate.url()).pathname.endsWith('/e2e-codex-session/turns')
  ));
  await page.locator('button[title="Send message"]:visible').click();
  const submittedTurn = await turnRequest;
  expect(submittedTurn.postDataJSON()).toMatchObject({
    accessModeId: 'full_access',
    content: message,
    requestedModelId: 'gpt-5-codex',
  });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});
