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

test('composer access mode selects full access and snapshots it into the turn', async ({
  page,
  request,
}, testInfo) => {
  await bootstrapAuthenticatedSession(page, request);
  await disableApproveForMeMode(page);
  await page.setViewportSize({ width: 1_280, height: 760 });
  await page.goto('/#/app/code');

  const newTaskButton = page.locator('[data-sidebar-new-session-trigger="true"]');
  await expect(newTaskButton).toBeVisible({ timeout: 60_000 });
  await newTaskButton.click();

  const newSessionComposer = page.locator('[data-new-session-composer="true"]');
  const accessModeTrigger = newSessionComposer.getByTestId('composer-access-mode-trigger');
  await expect(accessModeTrigger).toBeVisible();
  await expect(accessModeTrigger).toHaveAttribute('data-access-mode-id', 'ask_for_approval');
  await expect(accessModeTrigger).toHaveAccessibleName('Access mode: Ask for approval');
  expect(await accessModeTrigger.evaluate((element) => (
    element.parentElement?.previousElementSibling?.querySelector('.lucide-plus') !== null
  ))).toBe(true);

  await accessModeTrigger.click();
  const accessModeMenu = newSessionComposer.getByTestId('composer-access-mode-menu');
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

  const message = `E2E full access verification ${Date.now()}`;
  const composer = newSessionComposer.locator('textarea');
  await composer.fill(message);
  const turnRequest = page.waitForRequest((candidate) => (
    candidate.method() === 'POST'
      && new URL(candidate.url()).pathname.endsWith('/turns')
  ));
  await newSessionComposer.locator('button[title="Send message"]').click();
  const submittedTurn = await turnRequest;
  expect(submittedTurn.postDataJSON()).toMatchObject({
    accessModeId: 'full_access',
    content: message,
    requestedModelId: 'gpt-5-codex',
  });
});
