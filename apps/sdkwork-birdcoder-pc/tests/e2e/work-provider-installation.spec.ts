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

async function hideWorkProvidersFromCatalog(page: Page): Promise<() => number> {
  let requestCount = 0;
  await page.route('**/app/v3/api/ai/agent_engines', async (route) => {
    requestCount += 1;
    const response = await route.fetch();
    const payload = await response.json() as {
      data: {
        item: {
          engines: Array<{ tier?: string }>;
        };
      };
    };
    payload.data.item.engines = payload.data.item.engines.filter(
      (engine) => engine.tier !== 't2-autonomous',
    );
    await route.fulfill({ response, json: payload });
  });
  return () => requestCount;
}

async function installFakeDesktopProviderHost(page: Page): Promise<void> {
  await page.evaluate(() => {
    const runtimeWindow = window as Window & typeof globalThis & {
      __birdcoderInstallCalls?: Array<{ command: string; args?: Record<string, unknown> }>;
      __birdcoderHermesAttempts?: number;
      __TAURI_INTERNALS__?: {
        invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
      };
    };
    runtimeWindow.__birdcoderInstallCalls = [];
    runtimeWindow.__birdcoderHermesAttempts = 0;
    runtimeWindow.__TAURI_INTERNALS__ = {
      invoke: async (command, args) => {
        runtimeWindow.__birdcoderInstallCalls?.push({ command, args });
        const commandText = String(
          (args?.request as { commandText?: unknown } | undefined)?.commandText ?? '',
        );
        if (commandText.includes('hermes-agent')) {
          runtimeWindow.__birdcoderHermesAttempts =
            (runtimeWindow.__birdcoderHermesAttempts ?? 0) + 1;
          if (runtimeWindow.__birdcoderHermesAttempts === 1) {
            throw new Error('installer network unavailable');
          }
        }
        return {
          exitCode: 0,
          stdout: 'installed',
          stderr: '',
        };
      },
    };
  });
}

test('Work new-task menu keeps uninstalled Providers visible and offers retryable installation', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  const readCatalogRequestCount = await hideWorkProvidersFromCatalog(page);
  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });

  const modeTrigger = page.locator('[data-sidebar-mode-trigger="true"]');
  await modeTrigger.click();
  await page.locator('[data-sidebar-mode-option="work"]').click();
  await expect(page.locator('[data-work-sidebar="true"]')).toBeVisible();

  const newTaskTrigger = page.locator('[data-sidebar-new-session-trigger="true"]');
  await newTaskTrigger.click();
  const providerMenu = page.locator('[data-sidebar-new-session-menu="true"]');
  await expect(providerMenu).toBeVisible();
  const providerRows = providerMenu.locator('[data-work-provider-id]');
  await expect(providerRows).toHaveCount(2);
  await expect(providerRows.nth(0)).toHaveAttribute('data-work-provider-id', 'openclaw');
  await expect(providerRows.nth(1)).toHaveAttribute('data-work-provider-id', 'hermes');
  await expect(providerRows.nth(0)).toHaveAttribute(
    'data-work-provider-install-state',
    'not-installed',
  );
  await expect(providerRows.nth(1)).toHaveAttribute(
    'data-work-provider-install-state',
    'not-installed',
  );
  await expect(providerMenu.getByText('Not installed', { exact: true })).toHaveCount(2);

  await providerMenu.locator('[data-work-provider-id="openclaw"]').click();
  const openClawDialog = page.getByRole('dialog', { name: 'Install OpenClaw' });
  await expect(openClawDialog).toBeVisible();
  await expect(openClawDialog).toContainText('2026.7.2');
  const desktopDialogBox = await openClawDialog.boundingBox();
  expect(desktopDialogBox).not.toBeNull();
  expect(desktopDialogBox?.width).toBeGreaterThanOrEqual(420);

  await page.setViewportSize({ width: 768, height: 900 });
  const narrowDialogBox = await openClawDialog.boundingBox();
  expect(narrowDialogBox).not.toBeNull();
  expect(narrowDialogBox?.x ?? -1).toBeGreaterThanOrEqual(16);
  expect((narrowDialogBox?.x ?? 0) + (narrowDialogBox?.width ?? 0)).toBeLessThanOrEqual(752);

  await installFakeDesktopProviderHost(page);
  await openClawDialog.getByRole('button', { name: 'Install', exact: true }).click();
  await expect(openClawDialog).toContainText('OpenClaw was installed successfully.');
  await expect.poll(readCatalogRequestCount).toBeGreaterThanOrEqual(2);
  await expect.poll(() => page.evaluate(() => {
    const runtimeWindow = window as Window & typeof globalThis & {
      __birdcoderInstallCalls?: unknown[];
    };
    return runtimeWindow.__birdcoderInstallCalls?.length ?? 0;
  })).toBe(1);
  await openClawDialog.getByRole('button', { name: 'Done' }).click();

  await newTaskTrigger.click();
  await providerMenu.locator('[data-work-provider-id="hermes"]').click();
  const hermesDialog = page.getByRole('dialog', { name: 'Install Hermes Agent' });
  await hermesDialog.getByRole('button', { name: 'Install', exact: true }).click();
  await expect(hermesDialog).toContainText('installer network unavailable');
  await hermesDialog.getByRole('button', { name: 'Retry' }).click();
  await expect(hermesDialog).toContainText('Hermes Agent was installed successfully.');
  await expect.poll(() => page.evaluate(() => {
    const runtimeWindow = window as Window & typeof globalThis & {
      __birdcoderHermesAttempts?: number;
    };
    return runtimeWindow.__birdcoderHermesAttempts ?? 0;
  })).toBe(2);
});
