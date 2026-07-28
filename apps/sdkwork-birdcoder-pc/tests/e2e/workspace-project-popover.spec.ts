import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;

async function installAuthenticatedSession(page: Page, request: APIRequestContext) {
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
}

test('Workspace and Project Popover opens the dedicated Create project dialog', async ({
  page,
  request,
}, testInfo) => {
  await installAuthenticatedSession(page, request);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/app/code');

  const trigger = page.getByRole('button', { name: 'Workspace and Projects' });
  await expect(trigger).toBeVisible({ timeout: 60_000 });
  await expect(trigger).toContainText('Default Workspace');
  await expect(trigger).toContainText('E2E Project');
  await expect(page.getByRole('dialog', { name: 'Create project' })).toHaveCount(0);

  await trigger.click();
  const switcher = page.getByRole('dialog', { name: 'Workspace and Projects' });
  await expect(switcher).toBeVisible();
  await expect(switcher.getByText('Default Workspace').first()).toBeVisible();
  await expect(switcher.getByText('E2E Project').first()).toBeVisible();

  await switcher.getByRole('button', { name: /Default Workspace/u }).click();
  await expect(switcher).toBeVisible();

  const newProjectButton = switcher.getByRole('button', { name: 'New Project' });
  await newProjectButton.click();
  await expect(switcher).toHaveCount(0);

  const createProjectDialog = page.getByRole('dialog', { name: 'Create project' });
  await expect(createProjectDialog).toBeVisible();
  await expect(createProjectDialog.getByRole('textbox', { name: 'Project name' })).toBeFocused();
  await expect(createProjectDialog.getByRole('button', {
    name: 'Add a folder BirdCoder can read and edit',
  })).toBeVisible();
  await expect(createProjectDialog.getByRole('button', {
    exact: true,
    name: 'Create project',
  })).toBeDisabled();

  await page.screenshot({
    path: testInfo.outputPath('create-project-dialog-desktop.png'),
    fullPage: true,
  });

  await createProjectDialog.getByRole('textbox', { name: 'Project name' }).fill('Dialog Project');
  const projectCreateResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/app/v3/api/ai/projects'
  ));
  await createProjectDialog.getByRole('button', { exact: true, name: 'Create project' }).click();
  expect((await projectCreateResponse).ok()).toBe(true);
  await expect(createProjectDialog).toHaveCount(0);
  await expect(trigger).toContainText('Dialog Project');

  await page.setViewportSize({ width: 760, height: 680 });
  await trigger.click();
  await expect(switcher).toBeVisible();
  const switcherBox = await switcher.boundingBox();
  expect(switcherBox).not.toBeNull();
  expect(switcherBox?.x).toBeGreaterThanOrEqual(0);
  expect((switcherBox?.x ?? 0) + (switcherBox?.width ?? 0)).toBeLessThanOrEqual(760);
  expect((switcherBox?.y ?? 0) + (switcherBox?.height ?? 0)).toBeLessThanOrEqual(680);

  await switcher.getByRole('button', { name: 'New Project' }).click();
  await expect(createProjectDialog).toBeVisible();
  const dialogBox = await createProjectDialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox?.x).toBeGreaterThanOrEqual(0);
  expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0)).toBeLessThanOrEqual(760);
  expect(dialogBox?.y).toBeGreaterThanOrEqual(0);
  expect((dialogBox?.y ?? 0) + (dialogBox?.height ?? 0)).toBeLessThanOrEqual(680);

  await page.screenshot({
    path: testInfo.outputPath('create-project-dialog-narrow.png'),
    fullPage: true,
  });

  await page.keyboard.press('Escape');
  await expect(createProjectDialog).toHaveCount(0);
});

test('Workspace and Project Popover opens the dedicated Create Workspace dialog', async ({
  page,
  request,
}, testInfo) => {
  await installAuthenticatedSession(page, request);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/#/app/code');

  const trigger = page.getByRole('button', { name: 'Workspace and Projects' });
  await expect(trigger).toBeVisible({ timeout: 60_000 });
  await trigger.click();

  const switcher = page.getByRole('dialog', { name: 'Workspace and Projects' });
  await expect(switcher).toBeVisible();
  await switcher.getByRole('button', { name: 'New Workspace' }).click();
  await expect(switcher).toBeVisible();

  const createWorkspaceDialog = page.getByRole('dialog', { name: 'Create Workspace' });
  const workspaceNameInput = createWorkspaceDialog.getByRole('textbox', {
    name: 'Workspace name',
  });
  const createWorkspaceButton = createWorkspaceDialog.getByRole('button', {
    exact: true,
    name: 'Create Workspace',
  });
  await expect(createWorkspaceDialog).toBeVisible();
  await expect(workspaceNameInput).toBeFocused();
  await expect(createWorkspaceButton).toBeDisabled();

  await page.screenshot({
    path: testInfo.outputPath('create-workspace-dialog-desktop.png'),
    fullPage: true,
  });

  await workspaceNameInput.fill('Dialog Workspace');
  const workspaceCreateResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/app/v3/api/ai/workspaces'
  ));
  const workspaceRefreshResponse = page.waitForResponse((response) => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/app/v3/api/ai/workspaces'
  ));
  await createWorkspaceButton.click();
  expect((await workspaceCreateResponse).ok()).toBe(true);
  expect((await workspaceRefreshResponse).ok()).toBe(true);
  await expect(createWorkspaceDialog).toHaveCount(0);
  await expect(switcher).toBeVisible();
  await expect(switcher.getByRole('button', { name: 'Dialog Workspace' })).toBeVisible();
  await expect(trigger).toContainText('Dialog Workspace');

  await page.setViewportSize({ width: 520, height: 640 });
  await expect(switcher).toBeVisible();
  await switcher.getByRole('button', { name: 'New Workspace' }).click();
  await expect(createWorkspaceDialog).toBeVisible();

  const dialogBox = await createWorkspaceDialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox?.x).toBeGreaterThanOrEqual(0);
  expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0)).toBeLessThanOrEqual(520);
  expect(dialogBox?.y).toBeGreaterThanOrEqual(0);
  expect((dialogBox?.y ?? 0) + (dialogBox?.height ?? 0)).toBeLessThanOrEqual(640);

  await page.screenshot({
    path: testInfo.outputPath('create-workspace-dialog-narrow.png'),
    fullPage: true,
  });

  await page.keyboard.press('Escape');
  await expect(createWorkspaceDialog).toHaveCount(0);
  await expect(switcher).toBeVisible();
});
