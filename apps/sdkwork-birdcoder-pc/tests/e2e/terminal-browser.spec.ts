import { expect, test, type Page, type Route } from '@playwright/test';

function pageEnvelope(route: Route, items: unknown[]) {
  return {
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
    traceId: 'terminal-browser-project-page',
  };
}

function itemEnvelope(item: unknown) {
  return {
    code: 0,
    data: { item },
    traceId: 'terminal-browser-project-item',
  };
}

async function unloadPageForTeardown(page: Page) {
  await page.route('**/__birdcoder_e2e_teardown__', (route) => route.fulfill({
    body: '<!doctype html><title>BirdCoder E2E teardown</title>',
    contentType: 'text/html',
  }));
  await page.goto('/__birdcoder_e2e_teardown__');
}

test('Browser terminal fails closed without a governed project runtime binding', async ({
  page,
}, testInfo) => {
  const legacyProjectRequests: string[] = [];
  const terminalRequests: string[] = [];

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/^\/app\/v3\/api\/(?:workspaces|projects)(?:\/|$)/u.test(url.pathname)) {
      legacyProjectRequests.push(url.pathname);
    }
    if (url.pathname.startsWith('/app/v3/api/device/terminal/')) {
      terminalRequests.push(url.pathname);
    }
  });

  await page.addInitScript(() => {
    localStorage.setItem('sdkwork.birdcoder.appSession.v1', JSON.stringify({
      accessToken: 'e2e-access-token',
      authToken: 'e2e-auth-token',
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
        environment: 'test',
        deploymentMode: 'private',
        sessionId: 'e2e-session-1',
        tenantId: '0',
        organizationId: '0',
      },
    }));
  });

  const authenticatedSession = {
    accessToken: 'e2e-access-token',
    authToken: 'e2e-auth-token',
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
  const project = {
    id: '10001',
    projectId: 'project.e2e-terminal',
    tenantId: '0',
    organizationId: '0',
    ownerUserId: '1',
    name: 'E2E Project',
    description: 'Browser terminal boundary fixture.',
    visibility: 'private',
    status: 'active',
    driveAccessMode: 'disabled',
    defaultAgentId: 'agent.birdcoder',
    version: '1',
    createdAt: '2026-07-15T12:00:00.000Z',
    updatedAt: '2026-07-15T12:00:00.000Z',
  };

  await page.route('**/app/v3/api/auth/sessions/current', (route) => route.fulfill({
    json: {
      code: 0,
      data: authenticatedSession,
      traceId: 'terminal-browser-auth-session',
    },
  }));
  await page.route('**/app/v3/api/iam/users/current', (route) => route.fulfill({
    json: {
      code: 0,
      data: authenticatedSession.user,
      traceId: 'terminal-browser-current-user',
    },
  }));
  await page.route('**/app/v3/api/ai/projects?**', (route) => route.fulfill({
    json: pageEnvelope(route, [project]),
  }));
  await page.route(
    '**/app/v3/api/ai/projects/project.e2e-terminal',
    (route) => route.fulfill({ json: itemEnvelope(project) }),
  );
  await page.route(
    '**/app/v3/api/ai/agents/agent.birdcoder/sessions?**',
    (route) => route.fulfill({ json: pageEnvelope(route, []) }),
  );

  await page.goto('/#/app/code');
  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toHaveCount(0, {
    timeout: 45_000,
  });
  await expect(page.getByText('E2E Project').first()).toBeVisible({ timeout: 45_000 });

  const terminalNavigation = page.locator('button:has(svg.lucide-terminal):visible').first();
  await expect(terminalNavigation).toBeVisible({ timeout: 45_000 });
  await terminalNavigation.click();

  const unavailableStage = page.locator('[data-shell-layout="terminal-runtime-unavailable"]');
  await expect(unavailableStage).toBeVisible({ timeout: 30_000 });
  await expect(unavailableStage).toContainText(
    'No remote terminal runtime is configured for the current project.',
  );

  await page.screenshot({
    path: testInfo.outputPath('birdcoder-browser-terminal-unavailable.png'),
    fullPage: true,
  });

  expect(legacyProjectRequests).toEqual([]);
  expect(terminalRequests).toEqual([]);
  await unloadPageForTeardown(page);
});
