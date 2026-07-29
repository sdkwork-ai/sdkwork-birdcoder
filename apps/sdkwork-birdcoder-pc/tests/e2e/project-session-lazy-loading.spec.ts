import { expect, test, type APIRequestContext, type Page, type Request } from '@playwright/test';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;
const projectId = 'project.e2e-1';
const projectSessionsPath = `/app/v3/api/ai/projects/${projectId}/sessions`;

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

function isProjectSessionRequest(request: Request): boolean {
  return request.method() === 'GET' && new URL(request.url()).pathname === projectSessionsPath;
}

test('Project Sessions load lazily without per-session user-state 404s', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  const projectSessionRequests: Request[] = [];
  const workspaceSessionRequests: Request[] = [];
  const sessionUserStateListRequests: Request[] = [];
  const legacySessionUserStateRequests: Request[] = [];
  const applicationErrors: string[] = [];
  await page.route(
    /\/app\/v3\/api\/ai\/agents\/[^/]+\/sessions\/[^/]+\/user_state(?:\?.*)?$/u,
    (route) => {
      legacySessionUserStateRequests.push(route.request());
      return route.fulfill({ status: 500 });
    },
  );
  await page.route(
    /\/app\/v3\/api\/ai\/agents\/[^/]+\/sessions\/user_states(?:\?.*)?$/u,
    (route) => {
      sessionUserStateListRequests.push(route.request());
      const url = new URL(route.request().url());
      return route.fulfill({
        json: {
          code: 0,
          data: {
            items: [],
            pageInfo: {
              mode: 'offset',
              page: 1,
              pageSize: Number(url.searchParams.get('page_size') ?? 20),
              hasMore: false,
              totalItems: '0',
              totalPages: 0,
            },
          },
          traceId: 'e2e-empty-session-user-states',
        },
      });
    },
  );
  page.on('request', (outgoingRequest) => {
    const pathname = new URL(outgoingRequest.url()).pathname;
    if (isProjectSessionRequest(outgoingRequest)) {
      projectSessionRequests.push(outgoingRequest);
    }
    if (/\/app\/v3\/api\/ai\/workspaces\/[^/]+\/sessions$/u.test(pathname)) {
      workspaceSessionRequests.push(outgoingRequest);
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      applicationErrors.push(message.text());
    }
  });

  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  const expandProject = page.getByRole('button', { name: 'Expand E2E Project' });
  const collapseProject = page.getByRole('button', { name: 'Collapse E2E Project' });
  await expect.poll(async () => (
    await expandProject.count() > 0 || await collapseProject.count() > 0
  ), { timeout: 60_000 }).toBe(true);

  if (await expandProject.count() > 0) {
    await page.waitForTimeout(500);
    expect(projectSessionRequests).toHaveLength(0);
    expect(workspaceSessionRequests).toHaveLength(0);
    expect(legacySessionUserStateRequests).toHaveLength(0);

    const firstPageResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'GET'
        && url.pathname === projectSessionsPath
        && url.searchParams.get('page') === '1'
        && url.searchParams.get('page_size') === '20';
    });
    await expandProject.click();
    await firstPageResponse;
  }
  await expect(page.getByTitle(
    /Claude architecture review \| E2E Project \|/u,
  )).toBeVisible();
  expect(applicationErrors.filter((message) => (
    message.includes('Failed to refresh project sessions')
  ))).toHaveLength(0);
  expect(projectSessionRequests).toHaveLength(1);
  expect(legacySessionUserStateRequests).toHaveLength(0);
  const projectUserStateListRequests = sessionUserStateListRequests;
  if (projectUserStateListRequests.length > 0) {
    const requestedUserStateSessionIds = projectUserStateListRequests.flatMap((stateRequest) => {
      const url = new URL(stateRequest.url());
      const sessionIds = (url.searchParams.get('session_ids') ?? '').split(',').filter(Boolean);
      expect(sessionIds.length).toBeGreaterThan(0);
      expect(sessionIds.length).toBeLessThanOrEqual(100);
      expect(new Set(sessionIds).size).toBe(sessionIds.length);
      expect(url.searchParams.get('page_size')).toBe(String(sessionIds.length));
      return sessionIds;
    });
    expect(projectUserStateListRequests.length)
      .toBeLessThan(new Set(requestedUserStateSessionIds).size);
  }
  const initialUserStateListRequestCount = sessionUserStateListRequests.length;

  await collapseProject.click();
  await page.getByRole('button', { name: 'Expand E2E Project' }).click();
  await page.waitForTimeout(500);
  expect(projectSessionRequests).toHaveLength(1);
  expect(workspaceSessionRequests).toHaveLength(0);
  expect(sessionUserStateListRequests).toHaveLength(initialUserStateListRequestCount);
  expect(legacySessionUserStateRequests).toHaveLength(0);
});

test('project context-menu refresh coordinates mounted synchronization without abort errors', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  const applicationErrors: string[] = [];
  const failedRequests: string[] = [];
  let delayNextProjectActivityRequest = false;
  let releaseProjectActivityRequest: (() => void) | undefined;
  let notifyProjectActivityRequestStarted: (() => void) | undefined;
  const projectActivityRequestStarted = new Promise<void>((resolve) => {
    notifyProjectActivityRequestStarted = resolve;
  });
  const projectActivityRequestReleased = new Promise<void>((resolve) => {
    releaseProjectActivityRequest = resolve;
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      applicationErrors.push(message.text());
    }
  });
  page.on('requestfailed', (failedRequest) => {
    failedRequests.push(
      `${failedRequest.method()} ${failedRequest.url()} ${failedRequest.failure()?.errorText ?? 'unknown error'}`,
    );
  });
  await page.route('**/app/v3/api/ai/session_activity_summaries**', async (route) => {
    const url = new URL(route.request().url());
    if (
      delayNextProjectActivityRequest
      && url.searchParams.get('project_id') === projectId
    ) {
      delayNextProjectActivityRequest = false;
      notifyProjectActivityRequestStarted?.();
      await projectActivityRequestReleased;
    }
    await route.continue();
  });

  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  const projectRow = page.locator(`[data-project-id="${projectId}"]`).locator(':scope > div').first();
  await expect(projectRow).toContainText('E2E Project');

  await projectRow.click({ button: 'right' });
  const projectMenu = page.locator('.birdcoder-chrome-menu').filter({ hasText: 'Refresh Sessions' });
  const refreshAction = projectMenu.getByRole('button', { name: 'Refresh Sessions' });
  await expect(refreshAction).toBeVisible();
  delayNextProjectActivityRequest = true;
  await refreshAction.click();
  await projectActivityRequestStarted;

  await projectRow.click({ button: 'right' });
  const refreshingProjectMenu = page.locator('.birdcoder-chrome-menu').filter({
    hasText: 'Refreshing Sessions',
  });
  const refreshingAction = refreshingProjectMenu.getByRole('button', {
    name: 'Refreshing Sessions',
  });
  await expect(refreshingAction).toBeVisible();
  await expect(refreshingAction).toBeDisabled();

  const refreshResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'GET'
      && url.pathname === '/app/v3/api/ai/session_activity_summaries'
      && url.searchParams.get('project_id') === projectId;
  });
  releaseProjectActivityRequest?.();
  expect((await refreshResponse).ok()).toBe(true);
  await expect(page.getByText('Refreshed sessions for project: E2E Project')).toBeVisible();

  expect(applicationErrors.filter((message) => (
    message.includes('AbortError')
    || message.includes('superseded')
    || message.includes('Failed to refresh mounted project sessions')
    || message.includes('Failed to refresh project sessions')
  ))).toHaveLength(0);
  expect(failedRequests.filter((message) => message.includes('session_activity_summaries')))
    .toHaveLength(0);
});
