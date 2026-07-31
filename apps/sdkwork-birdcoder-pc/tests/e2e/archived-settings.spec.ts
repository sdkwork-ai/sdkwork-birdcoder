import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

interface ArchivedSessionFixture {
  agentId: string;
  createdAt: string;
  id: string;
  itemCount: string;
  lastItemSequence: string;
  organizationId: string;
  ownerUserId: string;
  projectId: string;
  sessionId: string;
  status: 'active' | 'closed';
  tenantId: string;
  title: string;
  updatedAt: string;
  version: string;
}

const archivedSessions: ArchivedSessionFixture[] = [
  {
    agentId: 'agent.codex',
    createdAt: '2026-07-28T00:58:00.000Z',
    id: '31001',
    itemCount: '12',
    lastItemSequence: '12',
    organizationId: '0',
    ownerUserId: 'e2e-user-1',
    projectId: 'project.e2e-1',
    sessionId: 'archived-session-review',
    status: 'closed',
    tenantId: '0',
    title: 'Repair upstream service list authorization',
    updatedAt: '2026-07-28T00:58:00.000Z',
    version: '4',
  },
  {
    agentId: 'agent.codex',
    createdAt: '2026-07-26T01:48:00.000Z',
    id: '31002',
    itemCount: '8',
    lastItemSequence: '8',
    organizationId: '0',
    ownerUserId: 'e2e-user-1',
    projectId: 'project.e2e-1',
    sessionId: 'archived-session-refactor',
    status: 'active',
    tenantId: '0',
    title: 'Refine component boundaries and verification',
    updatedAt: '2026-07-26T01:48:00.000Z',
    version: '3',
  },
  {
    agentId: 'agent.codex',
    createdAt: '2026-07-25T03:20:00.000Z',
    id: '31003',
    itemCount: '5',
    lastItemSequence: '5',
    organizationId: '0',
    ownerUserId: 'e2e-user-1',
    projectId: 'project.e2e-archive',
    sessionId: 'archived-session-secondary',
    status: 'closed',
    tenantId: '0',
    title: 'Validate secondary Workspace archive',
    updatedAt: '2026-07-25T03:20:00.000Z',
    version: '2',
  },
];

const archivedProviderSessionIdsBySessionId = new Map([
  ['archived-session-review', 'codex-archived-continuation-4d126a90'],
  ['archived-session-refactor', 'codex-archived-continuation-b0271e54'],
  ['archived-session-secondary', 'codex-archived-continuation-8fe390ad'],
]);

const workspaceFixtures = [
  {
    id: '9001',
    workspaceId: 'workspace.e2e-default',
    tenantId: '0',
    organizationId: '0',
    ownerUserId: 'e2e-user-1',
    name: 'Default Workspace',
    description: 'Default Workspace fixture.',
    isDefault: true,
    status: 'active',
    version: '1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '9002',
    workspaceId: 'workspace.e2e-secondary',
    tenantId: '0',
    organizationId: '0',
    ownerUserId: 'e2e-user-1',
    name: 'Secondary Workspace',
    description: 'Secondary Workspace fixture.',
    isDefault: false,
    status: 'active',
    version: '1',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  },
] as const;

const projectFixtures = [
  {
    id: '10001',
    projectId: 'project.e2e-1',
    workspaceId: 'workspace.e2e-default',
    tenantId: '0',
    organizationId: '0',
    ownerUserId: 'e2e-user-1',
    name: 'E2E Project',
    description: 'Default archived project fixture.',
    visibility: 'private',
    status: 'active',
    driveAccessMode: 'disabled',
    defaultAgentId: 'agent.codex',
    version: '1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '10002',
    projectId: 'project.e2e-archive',
    workspaceId: 'workspace.e2e-secondary',
    tenantId: '0',
    organizationId: '0',
    ownerUserId: 'e2e-user-1',
    name: 'Secondary Archive Project',
    description: 'Secondary Workspace archived project fixture.',
    visibility: 'private',
    status: 'active',
    driveAccessMode: 'disabled',
    defaultAgentId: 'agent.codex',
    version: '1',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  },
  {
    id: '10003',
    projectId: 'project.e2e-empty',
    workspaceId: 'workspace.e2e-secondary',
    tenantId: '0',
    organizationId: '0',
    ownerUserId: 'e2e-user-1',
    name: 'Secondary Empty Project',
    description: 'Secondary Workspace project without archived tasks.',
    visibility: 'private',
    status: 'active',
    driveAccessMode: 'disabled',
    defaultAgentId: 'agent.codex',
    version: '1',
    createdAt: '2026-02-02T00:00:00.000Z',
    updatedAt: '2026-02-02T00:00:00.000Z',
  },
] as const;

function listEnvelope(items: unknown[]) {
  return {
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
    traceId: 'archived-settings-e2e-list',
  };
}

function itemEnvelope(item: unknown) {
  return {
    code: 0,
    data: { item },
    traceId: 'archived-settings-e2e-item',
  };
}

function createUserState(session: ArchivedSessionFixture, hidden: boolean) {
  return {
    id: session.id,
    tenantId: session.tenantId,
    organizationId: session.organizationId,
    userId: session.ownerUserId,
    resourceType: 'session',
    resourceId: session.sessionId,
    hiddenAt: hidden ? session.updatedAt : null,
    lastOpenedAt: session.updatedAt,
    lastReadItemSequence: session.lastItemSequence,
    version: session.version,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function createRuntimeBinding(session: ArchivedSessionFixture) {
  const providerSessionId = archivedProviderSessionIdsBySessionId.get(session.sessionId);
  if (!providerSessionId) {
    throw new Error(`Missing provider Session fixture for ${session.sessionId}.`);
  }
  return {
    runtimeBindingId: `runtime-binding.${session.sessionId}`,
    tenantId: session.tenantId,
    organizationId: session.organizationId,
    sessionId: session.sessionId,
    runtimeLocationId: `runtime-location.${session.sessionId}`,
    hostMode: session.sessionId === 'archived-session-refactor' ? 'desktop' : 'server',
    transportKind: 'sdk-stream',
    providerBindingId: 'codex',
    modelId: 'gpt-5-codex',
    providerId: 'openai',
    providerSessionId,
    status: 'active',
    isCurrent: true,
    version: session.version,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    activatedAt: session.createdAt,
  };
}

async function installArchivedSessionRoutes(page: Page) {
  const archivedIds = new Set(archivedSessions.map((session) => session.sessionId));
  const deletedIds = new Set<string>();

  await page.route(/\/app\/v3\/api\/ai\/workspaces(?:\?.*)?$/u, (route) => route.fulfill({
    json: listEnvelope([...workspaceFixtures]),
  }));

  await page.route(/\/app\/v3\/api\/ai\/projects(?:\?.*)?$/u, (route) => {
    const url = new URL(route.request().url());
    const workspaceId = url.searchParams.get('workspaceId') ?? url.searchParams.get('workspace_id');
    return route.fulfill({
      json: listEnvelope(projectFixtures.filter((project) => (
        !workspaceId || project.workspaceId === workspaceId
      ))),
    });
  });

  await page.route(
    /\/app\/v3\/api\/ai\/projects\/(?<projectId>project\.e2e-(?:1|archive|empty))\/sessions(?:\?.*)?$/u,
    (route) => {
      const projectId = /\/projects\/(?<projectId>[^/]+)\/sessions$/u
        .exec(new URL(route.request().url()).pathname)?.groups?.projectId;
      return route.fulfill({
        json: listEnvelope(archivedSessions.filter((session) => (
          session.projectId === projectId && !deletedIds.has(session.sessionId)
        ))),
      });
    },
  );

  await page.route(/\/app\/v3\/api\/ai\/agents\/agent\.codex\/sessions\/user_states(?:\?.*)?$/u, (route) => {
    const requestedSessionIds = new Set(
      (new URL(route.request().url()).searchParams.get('session_ids') ?? '')
        .split(',')
        .filter(Boolean),
    );
    return route.fulfill({
      json: listEnvelope(
        archivedSessions
          .filter((session) => (
            !deletedIds.has(session.sessionId)
            && (requestedSessionIds.size === 0 || requestedSessionIds.has(session.sessionId))
          ))
          .map((session) => createUserState(session, archivedIds.has(session.sessionId))),
      ),
    });
  });

  await page.route(
    /\/app\/v3\/api\/ai\/agents\/agent\.codex\/sessions\/(?<sessionId>archived-session-[^/?]+)(?:\/(?<child>user_state|runtime_bindings))?(?:\?.*)?$/u,
    async (route: Route) => {
      const url = new URL(route.request().url());
      const match = /\/sessions\/(?<sessionId>archived-session-[^/]+)(?:\/(?<child>user_state|runtime_bindings))?$/u.exec(url.pathname);
      const sessionId = match?.groups?.sessionId ?? '';
      const session = archivedSessions.find((candidate) => candidate.sessionId === sessionId);
      if (!session || deletedIds.has(sessionId)) {
        await route.fulfill({ status: 404, json: { code: 404, detail: 'Session not found' } });
        return;
      }
      if (route.request().method() === 'DELETE') {
        deletedIds.add(sessionId);
        await route.fulfill({ status: 204 });
        return;
      }
      if (url.pathname.endsWith('/user_state')) {
        if (route.request().method() === 'PATCH') {
          archivedIds.delete(sessionId);
        }
        await route.fulfill({ json: itemEnvelope(createUserState(session, archivedIds.has(sessionId))) });
        return;
      }
      if (url.pathname.endsWith('/runtime_bindings')) {
        await route.fulfill({ json: listEnvelope([createRuntimeBinding(session)]) });
        return;
      }
      await route.fulfill({ json: itemEnvelope(session) });
    },
  );
}

test('archived settings match the compact grouped task workflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installArchivedSessionRoutes(page);
  await page.goto('/#/auth/login');

  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toBeVisible({ timeout: 45_000 });
  await page.getByRole('textbox', { name: 'Account' }).fill('e2e@test.sdkwork.local');
  await page.locator('input[type="password"]').first().fill('e2e-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  const settingsTab = page.getByTitle('Settings').first();
  await expect(settingsTab).toBeVisible({ timeout: 60_000 });
  await settingsTab.click();

  const sidebar = page.getByRole('complementary', { name: 'Settings navigation' });
  await sidebar.getByRole('button', { name: 'Archived Tasks' }).click();

  await expect(page.getByRole('heading', { name: 'Archived Tasks', level: 1 })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search archived tasks' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Filter tasks' })).toContainText('All tasks');
  await expect(page.getByRole('button', { name: 'Filter Workspaces' })).toContainText(
    'Default Workspace',
  );
  await expect(page.getByRole('button', { name: 'Filter projects' })).toContainText('All projects');
  await expect(page.getByRole('heading', { name: 'E2E Project', level: 2 })).toBeVisible();
  await expect(page.getByText('2 tasks', { exact: true })).toBeVisible();
  await expect(page.getByText(archivedSessions[0]!.title, { exact: true })).toBeVisible();
  await expect(page.getByText(archivedSessions[1]!.title, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Filter projects' }).click();
  await expect(page.getByRole('option', { name: 'E2E Project' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Secondary Archive Project' })).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'Secondary Empty Project' })).toHaveCount(0);
  await page.getByRole('option', { name: 'All projects' }).click();

  const searchBox = await page.getByRole('searchbox', {
    name: 'Search archived tasks',
  }).boundingBox();
  const taskFilterBox = await page.getByRole('button', { name: 'Filter tasks' }).boundingBox();
  const workspaceFilterBox = await page.getByRole('button', {
    name: 'Filter Workspaces',
  }).boundingBox();
  const projectFilterBox = await page.getByRole('button', { name: 'Filter projects' }).boundingBox();
  if (!searchBox || !taskFilterBox || !workspaceFilterBox || !projectFilterBox) {
    throw new Error('Archived toolbar controls must have measurable bounds.');
  }
  expect(Math.abs(searchBox.y - taskFilterBox.y)).toBeLessThan(1);
  expect(taskFilterBox.x - (searchBox.x + searchBox.width)).toBeGreaterThanOrEqual(10);
  expect(workspaceFilterBox.x - (taskFilterBox.x + taskFilterBox.width)).toBeGreaterThanOrEqual(10);
  expect(projectFilterBox.x - (workspaceFilterBox.x + workspaceFilterBox.width)).toBeGreaterThanOrEqual(10);

  await page.screenshot({
    path: testInfo.outputPath('archived-settings-desktop.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 1120, height: 900 });
  const archivedMain = page.getByRole('main');
  await expect.poll(() => archivedMain.evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  const compactSearchBox = await page.getByRole('searchbox', {
    name: 'Search archived tasks',
  }).boundingBox();
  const compactTaskFilterBox = await page.getByRole('button', {
    name: 'Filter tasks',
  }).boundingBox();
  const compactWorkspaceFilterBox = await page.getByRole('button', {
    name: 'Filter Workspaces',
  }).boundingBox();
  const compactProjectFilterBox = await page.getByRole('button', {
    name: 'Filter projects',
  }).boundingBox();
  if (
    !compactSearchBox
    || !compactTaskFilterBox
    || !compactWorkspaceFilterBox
    || !compactProjectFilterBox
  ) {
    throw new Error('Compact archived toolbar controls must have measurable bounds.');
  }
  expect(compactTaskFilterBox.y - (compactSearchBox.y + compactSearchBox.height))
    .toBeGreaterThanOrEqual(10);
  expect(Math.abs(compactTaskFilterBox.y - compactWorkspaceFilterBox.y)).toBeLessThan(1);
  expect(Math.abs(compactWorkspaceFilterBox.y - compactProjectFilterBox.y)).toBeLessThan(1);
  expect(compactWorkspaceFilterBox.x - (
    compactTaskFilterBox.x + compactTaskFilterBox.width
  )).toBeGreaterThanOrEqual(10);
  expect(compactProjectFilterBox.x - (
    compactWorkspaceFilterBox.x + compactWorkspaceFilterBox.width
  )).toBeGreaterThanOrEqual(10);
  await page.screenshot({
    path: testInfo.outputPath('archived-settings-compact.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByRole('button', { name: 'Filter tasks' }).click();
  await expect(page.getByText('Type', { exact: true })).toBeVisible();
  await expect(page.getByText('Sort by', { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('archived-settings-task-menu.png'),
    fullPage: true,
  });
  await page.getByRole('menuitemradio', { name: 'Local' }).click();
  await expect(page.getByText(archivedSessions[1]!.title, { exact: true })).toBeVisible();
  await expect(page.getByText(archivedSessions[0]!.title, { exact: true })).toHaveCount(0);
  await page.getByRole('menuitemradio', { name: 'All tasks' }).click();
  await page.getByRole('menuitemradio', { name: 'Alphabetical' }).click();
  await page.getByRole('button', { name: 'Filter tasks' }).click();

  await page.getByRole('button', { name: 'Filter Workspaces' }).click();
  await expect(page.getByRole('option', { name: 'Default Workspace' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Secondary Workspace' })).toBeVisible();
  await page.getByRole('option', { name: 'Secondary Workspace' }).click();
  await expect(page.getByRole('button', { name: 'Filter projects' })).toContainText('All projects');
  await expect(page.getByRole('heading', { name: 'E2E Project' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Secondary Archive Project' })).toBeVisible();

  await page.getByRole('button', { name: 'Filter projects' }).click();
  await expect(page.getByRole('option', { name: 'E2E Project' })).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'Secondary Archive Project' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Secondary Empty Project' })).toBeVisible();
  await page.getByRole('option', { name: 'Secondary Empty Project' }).click();
  await expect(page.getByRole('heading', { name: 'No matching tasks' })).toBeVisible();

  await page.getByRole('button', { name: 'Filter Workspaces' }).click();
  await page.getByRole('option', { name: 'All Workspaces' }).click();
  await expect(page.getByRole('button', { name: 'Filter Workspaces' })).toContainText(
    'All Workspaces',
  );
  await expect(page.getByRole('heading', { name: 'Secondary Archive Project' })).toBeVisible();

  await page.getByRole('button', { name: 'Filter projects' }).click();
  await expect(page.getByRole('option', { name: 'E2E Project' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Secondary Archive Project' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Secondary Empty Project' })).toBeVisible();
  await page.getByRole('option', { name: 'Secondary Archive Project' }).click();
  await expect(page.getByText(archivedSessions[2]!.title, { exact: true })).toBeVisible();
  await expect(page.getByText(archivedSessions[0]!.title, { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Filter Workspaces' }).click();
  await page.getByRole('option', { name: 'Default Workspace' }).click();
  await expect(page.getByRole('button', { name: 'Filter projects' })).toContainText('All projects');
  await expect(page.getByText(archivedSessions[2]!.title, { exact: true })).toHaveCount(0);

  const search = page.getByRole('searchbox', { name: 'Search archived tasks' });
  await search.fill('upstream');
  await expect(page.getByText(archivedSessions[0]!.title, { exact: true })).toBeVisible();
  await expect(page.getByText(archivedSessions[1]!.title, { exact: true })).toHaveCount(0);
  await search.fill('missing task');
  await expect(page.getByRole('heading', { name: 'No matching tasks' })).toBeVisible();
  await search.fill('');

  await page.getByRole('button', { name: 'Unarchive' }).first().click();
  await expect(page.getByText(archivedSessions[1]!.title, { exact: true })).toHaveCount(0);
  await expect(page.getByText('Task unarchived.', { exact: true })).toBeVisible();

  await page.getByRole('button', {
    name: `Delete ${archivedSessions[0]!.title} permanently`,
  }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText(`Delete "${archivedSessions[0]!.title}"?`);
  await dialog.getByRole('button', { name: 'Delete permanently' }).click();

  await expect(page.getByRole('heading', { name: 'No archived tasks' })).toBeVisible();
  await expect(page.getByText('1 task deleted permanently.', { exact: true })).toBeVisible();
});
