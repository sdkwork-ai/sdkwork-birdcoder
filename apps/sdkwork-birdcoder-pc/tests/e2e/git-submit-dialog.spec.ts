import { expect, test, type Page, type Route } from '@playwright/test';

function createE2eJwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ token_version: 1, ...claims })).toString('base64url');
  return `${header}.${payload}.signature`;
}

test.afterEach(async ({ page }) => {
  if (!page.isClosed()) {
    await page.close({ runBeforeUnload: false });
  }
});

async function openAuthenticatedCodeWorkspace(page: Page) {
  const tokenExpiresAt = Math.floor(Date.parse('2099-01-01T00:00:00.000Z') / 1_000);
  const accessToken = createE2eJwt({
    app_id: 'sdkwork-birdcoder',
    exp: tokenExpiresAt,
    organization_id: '0',
    session_id: 'e2e-session-1',
    tenant_id: '0',
    token_kind: 'access',
    user_id: 'e2e-user-1',
  });
  const authToken = createE2eJwt({
    auth_level: 'user',
    exp: tokenExpiresAt,
    session_id: 'e2e-session-1',
    token_kind: 'auth',
    user_id: 'e2e-user-1',
  });
  const workspace = {
    id: 'e2e-workspace-1',
    uuid: 'e2e-workspace-uuid-1',
    tenantId: '0',
    organizationId: '0',
    dataScope: 'PRIVATE',
    code: 'e2e-workspace',
    title: 'E2E Workspace',
    name: 'E2E Workspace',
    description: 'Git submit dialog browser fixture.',
    ownerId: 'e2e-user-1',
    leaderId: 'e2e-user-1',
    createdByUserId: 'e2e-user-1',
    status: 'active',
    viewerRole: 'owner',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const project = {
    id: 'e2e-project-1',
    uuid: 'e2e-project-uuid-1',
    tenantId: '0',
    organizationId: '0',
    dataScope: 'PRIVATE',
    workspaceId: workspace.id,
    workspaceUuid: workspace.uuid,
    userId: 'e2e-user-1',
    ownerId: 'e2e-user-1',
    leaderId: 'e2e-user-1',
    code: 'e2e-project',
    title: 'E2E Project',
    name: 'E2E Project',
    description: 'Git submit dialog browser fixture.',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const codingSession = {
    id: 'e2e-coding-session-1',
    workspaceId: workspace.id,
    projectId: project.id,
    title: 'E2E Session',
    status: 'active',
    hostMode: 'web',
    engineId: 'codex',
    modelId: 'e2e-model',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const offsetPage = (route: Route, items: unknown[]) => ({
    code: 0,
    data: {
      items,
      pageInfo: {
        hasMore: false,
        mode: 'offset',
        page: 1,
        pageSize: Number(
          new URL(route.request().url()).searchParams.get('page_size') ?? 20,
        ),
        totalItems: String(items.length),
        totalPages: items.length > 0 ? 1 : 0,
      },
    },
    traceId: 'git-submit-dialog-e2e',
  });
  const itemEnvelope = (item: unknown) => ({
    code: 0,
    data: { item },
    traceId: 'git-submit-dialog-e2e',
  });
  const authenticatedSession = {
    accessToken,
    authToken,
    refreshToken: 'e2e-refresh-token',
    sessionId: 'e2e-session-1',
    expiresAt: '2099-01-01T00:00:00.000Z',
    user: {
      id: 'e2e-user-1',
      uuid: 'e2e-user-uuid-1',
      tenantId: '0',
      organizationId: '0',
      name: 'E2E User',
      email: 'e2e@test.sdkwork.local',
    },
    context: {
      appId: 'sdkwork-birdcoder',
      authLevel: 'user',
      dataScope: [],
      environment: 'test',
      deploymentMode: 'private',
      permissionScope: [],
      sessionId: 'e2e-session-1',
      tenantId: '0',
      organizationId: '0',
      userId: 'e2e-user-1',
    },
  };

  await page.route('**/app/v3/api/auth/sessions/current', (route) => route.fulfill({
    json: {
      code: 0,
      data: authenticatedSession,
      traceId: 'git-submit-dialog-current-session',
    },
  }));
  await page.route('**/app/v3/api/iam/users/current', (route) => route.fulfill({
    json: {
      code: 0,
      data: authenticatedSession.user,
      traceId: 'git-submit-dialog-current-user',
    },
  }));
  await page.route('**/app/v3/api/workspaces?**', (route) => route.fulfill({ json: offsetPage(route, [workspace]) }));
  await page.route('**/app/v3/api/projects?**', (route) => route.fulfill({ json: offsetPage(route, [project]) }));
  await page.route('**/app/v3/api/projects/e2e-project-1', (route) => route.fulfill({ json: itemEnvelope(project) }));
  await page.route('**/app/v3/api/intelligence/coding_sessions?**', (route) => route.fulfill({ json: offsetPage(route, [codingSession]) }));
  await page.route('**/app/v3/api/intelligence/coding_sessions/e2e-coding-session-1', (route) => route.fulfill({ json: itemEnvelope(codingSession) }));
  await page.route(
    /\/app\/v3\/api\/intelligence\/coding_sessions\/e2e-coding-session-1\/(?:artifacts|checkpoints|events)(?:\?.*)?$/,
    (route) => route.fulfill({ json: offsetPage(route, []) }),
  );
  await page.addInitScript(({ accessToken: persistedAccessToken, authToken: persistedAuthToken }) => {
    localStorage.setItem('sdkwork.birdcoder.appSession.v1', JSON.stringify({
      accessToken: persistedAccessToken,
      authToken: persistedAuthToken,
      refreshToken: 'e2e-refresh-token',
      sessionId: 'e2e-session-1',
      expiresAt: 4_070_908_800,
      storedAt: Math.floor(Date.now() / 1_000),
      user: {
        id: 'e2e-user-1',
        uuid: 'e2e-user-uuid-1',
        tenantId: '0',
        organizationId: '0',
        name: 'E2E User',
        email: 'e2e@test.sdkwork.local',
      },
      context: {
        appId: 'sdkwork-birdcoder',
        authLevel: 'user',
        dataScope: [],
        environment: 'test',
        deploymentMode: 'private',
        permissionScope: [],
        sessionId: 'e2e-session-1',
        tenantId: '0',
        organizationId: '0',
        userId: 'e2e-user-1',
      },
    }));
  }, { accessToken, authToken });
  await page.goto('/#/app/code');
  const newProjectButton = page.getByRole('button', { name: 'New Project' });
  const signInButton = page.getByRole('button', { name: 'Sign in' });
  await expect.poll(async () => (
    await newProjectButton.isVisible() || await signInButton.isVisible()
  ), { timeout: 45_000 }).toBe(true);
  if (await signInButton.isVisible()) {
    await page.getByRole('textbox', { name: 'Account' }).fill('e2e@test.sdkwork.local');
    await page.locator('input[type="password"]').first().fill('e2e-password');
    await signInButton.click();
  }
  await expect(newProjectButton).toBeVisible({
    timeout: 60_000,
  });
}

async function routeLargeSandboxDirectory(page: Page) {
  const capabilities = {
    browse: true,
    createFile: true,
    createDirectory: true,
    deleteEntry: true,
    moveEntry: true,
    readFile: true,
    selectDirectory: true,
    writeFile: true,
  };
  const roots = ['C:\\', 'D:\\', 'E:\\', 'F:\\'].map((displayName, index) => ({
    id: `e2e-sandbox-${index + 1}`,
    displayName,
    rootEntryId: `e2e-root-${index + 1}`,
    capabilities,
  }));
  const entries = Array.from({ length: 1_000 }, (_, index) => {
    const entryNumber = String(Math.floor(index / 2) + 1).padStart(4, '0');
    const kind = index % 2 === 0 ? 'directory' as const : 'file' as const;
    const name = kind === 'directory'
      ? `Folder ${entryNumber}`
      : `Document ${entryNumber}.txt`;
    return {
      id: `e2e-entry-${index + 1}`,
      sandboxId: roots[0].id,
      parentId: roots[0].rootEntryId,
      name,
      kind,
      logicalPath: name,
      revision: `revision-${index + 1}`,
    };
  });
  const envelope = (data: unknown) => ({
    code: 0,
    data,
    traceId: 'sandbox-explorer-e2e',
  });
  let directoryRequestCount = 0;

  await page.route('**/app/v3/api/drive/sandboxes?**', (route) => route.fulfill({
    json: envelope({
      items: roots,
      pageInfo: {
        hasMore: false,
        mode: 'offset',
        page: 1,
        pageSize: 50,
        totalItems: String(roots.length),
        totalPages: 1,
      },
    }),
  }));
  await page.route('**/app/v3/api/drive/sandboxes/*/entries?**', async (route) => {
    directoryRequestCount += 1;
    if (directoryRequestCount > 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    await route.fulfill({
      json: envelope({
        items: entries,
        pageInfo: {
          hasMore: false,
          mode: 'cursor',
          nextCursor: null,
          pageSize: 1_000,
        },
      }),
    });
  });
}

test('Git commit and push requires a commit message without mutating the repository', async ({
  page,
}, testInfo) => {
  await openAuthenticatedCodeWorkspace(page);
  await expect(page.getByText('E2E Project').first()).toBeVisible({ timeout: 60_000 });

  const gitControl = page.locator('button:has(svg.lucide-folder-git-2):visible').first();
  await expect(gitControl).toBeVisible({ timeout: 30_000 });
  await gitControl.click();

  const gitOverview = page.getByRole('dialog', { name: 'Git Overview' });
  await expect(gitOverview).toBeVisible();
  await gitOverview.getByRole('button', { name: 'Push to Remote...' }).click();

  const submitDialog = page.getByRole('dialog', { name: 'Commit changes' });
  await expect(submitDialog).toBeVisible();
  await expect(submitDialog.getByLabel('Commit message')).toBeFocused();
  await expect(submitDialog.getByRole('checkbox')).toBeChecked();

  await submitDialog.getByRole('button', { name: 'Commit and push' }).click();
  await expect(submitDialog.getByText('Enter a commit message to continue.')).toBeVisible();
  await expect(submitDialog.getByLabel('Commit message')).toBeFocused();

  await page.screenshot({
    path: testInfo.outputPath('git-submit-dialog.png'),
    fullPage: true,
  });
  await submitDialog.getByRole('checkbox').uncheck();
  await expect(submitDialog.getByRole('checkbox')).not.toBeChecked();

  await page.keyboard.press('Escape');
  await expect(submitDialog).toHaveCount(0);
});

test('sandbox explorer presents a responsive professional large-directory experience', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1_920, height: 1_080 });
  await routeLargeSandboxDirectory(page);
  await openAuthenticatedCodeWorkspace(page);

  const openFolderButton = page.getByRole('button', { name: 'Open Server Folder', exact: true }).first();
  await expect(openFolderButton).toBeVisible({ timeout: 60_000 });
  await openFolderButton.click();

  const dialog = page.getByRole('dialog', { name: 'Select a server project directory' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('border-radius', '0px');
  await expect(dialog).toHaveCSS('width', '1920px');
  await expect(dialog).toHaveCSS('height', '1080px');

  for (const drive of ['C:\\', 'D:\\', 'E:\\', 'F:\\']) {
    await expect(dialog.getByRole('treeitem', { name: `Open sandbox ${drive}` })).toBeVisible();
  }

  const directoryItems = dialog.locator('[data-entry-id]');
  await expect(directoryItems).toHaveCount(1_000, { timeout: 30_000 });
  await expect(dialog.getByText('1000 items loaded')).toBeVisible();
  await expect(dialog.getByText('All items loaded')).toBeVisible();
  await expect(dialog.locator('[data-entry-id][tabindex="0"]')).toHaveCount(1);

  const firstFolder = dialog.getByRole('button', { name: 'Folder 0001', exact: true });
  const secondFolder = dialog.getByRole('button', { name: 'Folder 0002', exact: true });
  await firstFolder.focus();
  await page.keyboard.press('ArrowDown');
  await expect(secondFolder).toBeFocused();

  await page.keyboard.press('F5');
  await expect(dialog.getByText('Refreshing\u2026')).toBeVisible();
  await expect(secondFolder).toBeVisible();
  await expect(dialog.getByText('Refreshing\u2026')).toHaveCount(0);
  await expect(secondFolder).toBeFocused();

  await dialog.getByTitle('Switch to grid view').click();
  await expect(dialog.locator('.sdkwork-sandbox-explorer__grid-view')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('sandbox-explorer-desktop.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 640, height: 800 });
  await expect(dialog.getByLabel('Sandbox', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('tree', { name: 'Available sandboxes' })).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('sandbox-explorer-narrow.png'),
    fullPage: true,
  });
});
