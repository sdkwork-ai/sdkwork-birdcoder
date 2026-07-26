import { expect, test } from '@playwright/test';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;

test('unified Workspace and Project Popover supports scoped Project creation', async ({
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

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/app/code');

  const trigger = page.getByRole('button', { name: 'Workspace and Projects' });
  await expect(trigger).toBeVisible({ timeout: 60_000 });
  await expect(trigger).toContainText('Default Workspace');
  await expect(trigger).toContainText('E2E Project');
  await expect(page.getByRole('button', { name: 'New Project' })).toHaveCount(0);

  await trigger.click();
  const switcher = page.getByRole('dialog', { name: 'Workspace and Projects' });
  await expect(switcher).toBeVisible();
  await expect(switcher.getByText('Default Workspace').first()).toBeVisible();
  await expect(switcher.getByText('E2E Project').first()).toBeVisible();

  await switcher.getByRole('button', { name: /Default Workspace/u }).click();
  await expect(switcher).toBeVisible();

  const newProjectButton = switcher.getByRole('button', { name: 'New Project' });
  await newProjectButton.click();
  await expect(switcher.getByRole('button', { name: 'Blank Project' })).toBeVisible();
  await expect(switcher.getByRole('button', { name: 'Project from Folder' })).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('workspace-project-popover-desktop.png'),
    fullPage: true,
  });

  await switcher.getByRole('button', { name: 'Blank Project' }).click();
  await switcher.getByRole('textbox', { name: 'Blank Project' }).fill('Popover Project');
  const projectCreateResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/app/v3/api/ai/projects'
  ));
  await switcher.getByRole('button', { name: 'Create' }).click();
  expect((await projectCreateResponse).ok()).toBe(true);
  await expect(switcher).toHaveCount(0);
  await expect(trigger).toContainText('Popover Project');

  await page.setViewportSize({ width: 760, height: 680 });
  await trigger.click();
  await expect(switcher).toBeVisible();
  const switcherBox = await switcher.boundingBox();
  expect(switcherBox).not.toBeNull();
  expect(switcherBox?.x).toBeGreaterThanOrEqual(0);
  expect((switcherBox?.x ?? 0) + (switcherBox?.width ?? 0)).toBeLessThanOrEqual(760);
  expect((switcherBox?.y ?? 0) + (switcherBox?.height ?? 0)).toBeLessThanOrEqual(680);

  await page.screenshot({
    path: testInfo.outputPath('workspace-project-popover-narrow.png'),
    fullPage: true,
  });

  await page.keyboard.press('Escape');
  await expect(switcher).toHaveCount(0);
});
