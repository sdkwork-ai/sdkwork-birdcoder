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

test('Project Sessions load lazily and tolerate missing optional user state', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  const projectSessionRequests: Request[] = [];
  const workspaceSessionRequests: Request[] = [];
  const applicationErrors: string[] = [];
  await page.route(
    /\/app\/v3\/api\/ai\/agents\/[^/]+\/sessions\/[^/]+\/user_state(?:\?.*)?$/u,
    (route) => route.fulfill({
      body: JSON.stringify({
        type: 'https://docs.sdkwork.com/problems/40401',
        title: 'Not found',
        status: 404,
        code: 40401,
        detail: 'session user state not found',
        instance: 'GET /app/v3/api/ai/agents/{agentId}/sessions/{sessionId}/user_state',
        operationId: 'agents.sessionUserStates.retrieve',
        i18nKey: 'errors.result.40401',
        traceId: 'e2e-missing-session-user-state',
      }),
      contentType: 'application/problem+json',
      status: 404,
    }),
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
  await expect(expandProject).toBeVisible();

  await page.waitForTimeout(500);
  expect(projectSessionRequests).toHaveLength(0);
  expect(workspaceSessionRequests).toHaveLength(0);

  const firstPageResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'GET'
      && url.pathname === projectSessionsPath
      && url.searchParams.get('page') === '1'
      && url.searchParams.get('page_size') === '20';
  });
  await expandProject.click();
  await firstPageResponse;
  await expect(page.getByTitle(
    /Claude architecture review \| E2E Project \|/u,
  )).toBeVisible();
  expect(applicationErrors.filter((message) => (
    message.includes('Failed to refresh project sessions')
  ))).toHaveLength(0);
  expect(projectSessionRequests).toHaveLength(1);

  await page.getByRole('button', { name: 'Collapse E2E Project' }).click();
  await page.getByRole('button', { name: 'Expand E2E Project' }).click();
  await page.waitForTimeout(500);
  expect(projectSessionRequests).toHaveLength(1);
  expect(workspaceSessionRequests).toHaveLength(0);
});
