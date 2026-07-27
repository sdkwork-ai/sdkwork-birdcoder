import { expect, test } from '@playwright/test';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;

test('removes a Project from the app without deleting local files or existing chats', async ({
  page,
  request,
}, testInfo) => {
  const sessionResponse = await request.post(
    `${mockApiBaseUrl}/app/v3/api/auth/sessions`,
    {
      data: {
        account: 'e2e@test.sdkwork.local',
        password: 'e2e-password',
      },
    },
  );
  expect(sessionResponse.ok()).toBe(true);
  const sessionPayload = await sessionResponse.json() as {
    data: {
      accessToken: string;
      authToken: string;
      context: Record<string, unknown>;
      expiresAt: string;
      refreshToken: string;
      sessionId: string;
      user: Record<string, unknown>;
    };
  };

  await page.addInitScript((session) => {
    localStorage.setItem('sdkwork.birdcoder.appSession.v1', JSON.stringify({
      ...session,
      expiresAt: Math.floor(Date.parse(session.expiresAt) / 1_000),
      storedAt: Math.floor(Date.now() / 1_000),
    }));
  }, sessionPayload.data);
  await page.route('**/app/v3/api/ai/projects/project.e2e-1', async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 204 });
      return;
    }
    await route.continue();
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/app/code');

  const trigger = page.getByRole('button', { name: 'Workspace and Projects' });
  await expect(trigger).toContainText('E2E Project', { timeout: 60_000 });
  await trigger.click();

  const switcher = page.getByRole('dialog', { name: 'Workspace and Projects' });
  const project = switcher.getByRole('article', { name: 'E2E Project' });
  await expect(project).toBeVisible();
  await project.getByRole('button', { name: 'More actions' }).click();
  await project.getByRole('button', { name: 'Remove Project' }).click();

  const confirmation = page.getByRole('alertdialog', { name: 'Remove E2E Project?' });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText(
    "This removes the project from the app. Files on your computer and existing chats won't be deleted.",
  );
  await expect(confirmation.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expect(confirmation.getByRole('button', {
    exact: true,
    name: 'Remove project',
  })).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('remove-project-dialog-desktop.png'),
    fullPage: true,
  });

  const removeRequest = page.waitForRequest((request) => (
    request.method() === 'DELETE'
    && new URL(request.url()).pathname === '/app/v3/api/ai/projects/project.e2e-1'
  ));
  await confirmation.getByRole('button', { exact: true, name: 'Remove project' }).click();
  await removeRequest;
  await expect(confirmation).toHaveCount(0);
  await expect(trigger).not.toContainText('E2E Project');

  await trigger.click();
  await expect(switcher.getByRole('article', { name: 'E2E Project' })).toHaveCount(0);
});
