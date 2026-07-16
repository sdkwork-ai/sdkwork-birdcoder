import { expect, test, type Page } from '@playwright/test';

function createE2eJwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ token_version: 1, ...claims })).toString('base64url');
  return `${header}.${payload}.signature`;
}

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
  const offsetPage = (items: unknown[]) => ({
    code: 0,
    data: {
      items,
      pageInfo: {
        hasMore: false,
        mode: 'offset',
        page: 1,
        pageSize: 20,
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

  await page.route('**/app/v3/api/workspaces?**', (route) => route.fulfill({ json: offsetPage([workspace]) }));
  await page.route('**/app/v3/api/projects?**', (route) => route.fulfill({ json: offsetPage([project]) }));
  await page.route('**/app/v3/api/projects/e2e-project-1', (route) => route.fulfill({ json: itemEnvelope(project) }));
  await page.route('**/app/v3/api/intelligence/coding_sessions?**', (route) => route.fulfill({ json: offsetPage([codingSession]) }));
  await page.route('**/app/v3/api/intelligence/coding_sessions/e2e-coding-session-1', (route) => route.fulfill({ json: itemEnvelope(codingSession) }));
  await page.route(
    /\/app\/v3\/api\/intelligence\/coding_sessions\/e2e-coding-session-1\/(?:artifacts|checkpoints|events)(?:\?.*)?$/,
    (route) => route.fulfill({ json: offsetPage([]) }),
  );
  await page.route('**/app/v3/api/native_sessions?**', (route) => route.fulfill({ json: offsetPage([]) }));
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
  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toHaveCount(0, {
    timeout: 45_000,
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
