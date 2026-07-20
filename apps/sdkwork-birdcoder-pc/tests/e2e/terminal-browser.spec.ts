import { expect, test } from '@playwright/test';

const terminalSessionId = 'browser-terminal-e2e-session';

function itemEnvelope(item: unknown) {
  return {
    code: 0,
    data: { item },
    traceId: '00000000-0000-4000-8000-000000000001',
  };
}

test('Browser terminal uses the protected App API and renders the full xterm surface', async ({
  page,
}, testInfo) => {
  page.on('pageerror', (error) => {
    console.log(`[terminal-e2e:pageerror] ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      console.log(`[terminal-e2e:console] ${message.text()}`);
    }
  });
  page.on('requestfailed', (request) => {
    console.log(`[terminal-e2e:requestfailed] ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`);
  });
  page.on('response', async (response) => {
    if (response.status() >= 400) {
      console.log(`[terminal-e2e:http] ${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  const terminalRequests: Array<{
    method: string;
    path: string;
    authorization: string | undefined;
    accessToken: string | undefined;
    body: string | null;
  }> = [];

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
  const workspace = {
    id: 'e2e-workspace-1',
    uuid: 'e2e-workspace-uuid-1',
    tenantId: '0',
    organizationId: '0',
    dataScope: 'PRIVATE',
    code: 'e2e-workspace',
    title: 'E2E Workspace',
    name: 'E2E Workspace',
    ownerId: 'e2e-user-1',
    leaderId: 'e2e-user-1',
    createdByUserId: 'e2e-user-1',
    status: 'active',
    viewerRole: 'owner',
    createdAt: '2026-07-15T12:00:00.000Z',
    updatedAt: '2026-07-15T12:00:00.000Z',
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
    status: 'active',
    createdAt: '2026-07-15T12:00:00.000Z',
    updatedAt: '2026-07-15T12:00:00.000Z',
  };
  const pageEnvelope = (items: unknown[]) => ({
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
    traceId: 'terminal-browser-empty-page',
  });
  await page.route('**/app/v3/api/workspaces?**', (route) => route.fulfill({ json: pageEnvelope([workspace]) }));
  await page.route('**/app/v3/api/projects?**', (route) => route.fulfill({ json: pageEnvelope([project]) }));
  await page.route('**/app/v3/api/projects/e2e-project-1', (route) => route.fulfill({ json: itemEnvelope(project) }));
  await page.route('**/app/v3/api/projects/e2e-project-1/runtime_location_preferences?**', (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('page_size')).toBe('20');
    expect(url.searchParams.has('pageSize')).toBe(false);
    return route.fulfill({
      json: pageEnvelope([{
        id: 'e2e-terminal-preference-1',
        projectId: project.id,
        subjectUserId: 'e2e-user-1',
        capability: 'terminal',
        runtimeLocationId: 'e2e-runtime-location-1',
        version: '1',
        createdAt: '2026-07-15T12:00:00.000Z',
        updatedAt: '2026-07-15T12:00:00.000Z',
      }]),
    });
  });
  await page.route('**/app/v3/api/native_sessions?**', (route) => route.fulfill({ json: pageEnvelope([]) }));
  await page.route('**/app/v3/api/intelligence/coding_sessions?**', (route) => route.fulfill({ json: pageEnvelope([]) }));

  await page.route('**/app/v3/api/device/terminal/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    terminalRequests.push({
      method: request.method(),
      path: `${url.pathname}${url.search}`,
      authorization: request.headers().authorization,
      accessToken: request.headers()['access-token'],
      body: request.postData(),
    });

    if (url.pathname.endsWith('/events')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          'event: session.output',
          `data: ${JSON.stringify({
            sessionId: terminalSessionId,
            nextCursor: '2',
            entry: {
              sequence: 2,
              kind: 'output',
              payload: 'SDKWork Browser terminal ready\r\n$ ',
              occurredAt: '2026-07-15T12:00:01.000Z',
            },
          })}`,
          '',
          '',
        ].join('\n'),
      });
      return;
    }

    if (request.method() === 'GET' && url.pathname.endsWith('/sessions')) {
      await route.fulfill({ json: itemEnvelope({ sessions: [], attachments: [] }) });
      return;
    }

    if (request.method() === 'POST' && url.pathname.endsWith('/sessions')) {
      await route.fulfill({
        status: 201,
        json: itemEnvelope({
          sessionId: terminalSessionId,
          projectId: project.id,
          runtimeLocationId: 'e2e-runtime-location-1',
          target: 'server-runtime-node',
          state: 'Running',
          createdAt: '2026-07-15T12:00:00.000Z',
          lastActiveAt: '2026-07-15T12:00:00.000Z',
          modeTags: ['cli-native'],
          tags: ['surface:browser', 'profile:bash'],
          attachmentId: 'browser-terminal-e2e-attachment',
          cursor: '1',
          lastAckSequence: 1,
          writable: true,
          invokedProgram: '/bin/bash',
          invokedArgs: ['-l'],
          replayEntry: {
            sequence: 1,
            kind: 'state',
            payload: '{"state":"running"}',
            occurredAt: '2026-07-15T12:00:00.000Z',
          },
        }),
      });
      return;
    }

    if (request.method() === 'GET' && url.pathname.endsWith('/replay')) {
      await route.fulfill({
        json: itemEnvelope({
          sessionId: terminalSessionId,
          fromCursor: null,
          nextCursor: '1',
          hasMore: false,
          entries: [],
        }),
      });
      return;
    }

    if (url.pathname.endsWith('/input') || url.pathname.endsWith('/input_bytes')) {
      await route.fulfill({
        json: itemEnvelope({ sessionId: terminalSessionId, acceptedBytes: 24 }),
      });
      return;
    }

    if (url.pathname.endsWith('/resize')) {
      await route.fulfill({
        json: itemEnvelope({ sessionId: terminalSessionId, cols: 120, rows: 30 }),
      });
      return;
    }

    if (url.pathname.endsWith('/terminate')) {
      await route.fulfill({
        json: itemEnvelope({ sessionId: terminalSessionId, state: 'Stopping' }),
      });
      return;
    }

    await route.abort();
  });

  await page.goto('/#/app/code');
  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toHaveCount(0, {
    timeout: 45_000,
  });

  const terminalNavigation = page.locator('button:has(svg.lucide-terminal):visible').first();
  await expect(terminalNavigation).toBeVisible({ timeout: 45_000 });
  await terminalNavigation.click();

  const shell = page.locator('[data-shell-layout="terminal-tabs"]');
  const xterm = page.locator('.xterm');
  const screen = page.locator('.xterm-screen');
  const helperTextarea = page.locator('.xterm-helper-textarea');
  await expect(shell).toBeVisible({ timeout: 60_000 });
  await expect(screen).toBeVisible({ timeout: 30_000 });
  await expect.poll(
    () => terminalRequests.some((request) => request.path.endsWith('/events')),
  ).toBe(true);

  const shellBox = await shell.boundingBox();
  const xtermBox = await xterm.boundingBox();
  const screenBox = await screen.boundingBox();
  expect(shellBox?.width).toBeGreaterThan(1000);
  expect(shellBox?.height).toBeGreaterThan(600);
  expect(xtermBox?.width).toBeGreaterThan(900);
  expect(screenBox?.width).toBeGreaterThan(900);
  await expect(helperTextarea).toHaveCSS('position', 'absolute');

  await helperTextarea.focus();
  await page.keyboard.type('echo browser-terminal');
  await page.keyboard.press('Enter');
  await expect.poll(
    () => terminalRequests.some((request) => request.path.endsWith('/input')),
  ).toBe(true);

  await page.screenshot({
    path: testInfo.outputPath('birdcoder-browser-terminal-desktop.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileShellBox = await shell.boundingBox();
  expect(mobileShellBox?.width).toBeGreaterThanOrEqual(320);
  expect(mobileShellBox?.height).toBeGreaterThan(600);
  await page.screenshot({
    path: testInfo.outputPath('birdcoder-browser-terminal-mobile.png'),
    fullPage: true,
  });

  expect(terminalRequests).toEqual(expect.arrayContaining([
    expect.objectContaining({
      method: 'POST',
      path: '/app/v3/api/device/terminal/sessions',
    }),
    expect.objectContaining({
      path: `/app/v3/api/device/terminal/sessions/${terminalSessionId}/events`,
    }),
    expect.objectContaining({
      path: `/app/v3/api/device/terminal/sessions/${terminalSessionId}/input`,
    }),
  ]));
  expect(terminalRequests.every((request) => (
    request.path.startsWith('/app/v3/api/device/terminal/')
  ))).toBe(true);
  expect(terminalRequests.every((request) => (
    request.authorization === 'Bearer e2e-auth-token'
  ))).toBe(true);
  expect(terminalRequests.every((request) => (
    request.accessToken === 'e2e-access-token'
  ))).toBe(true);
  const createRequest = terminalRequests.find((request) => (
    request.method === 'POST' && request.path === '/app/v3/api/device/terminal/sessions'
  ));
  expect(JSON.parse(createRequest?.body ?? '{}')).toMatchObject({
    projectId: project.id,
    runtimeLocationId: 'e2e-runtime-location-1',
  });
  expect(JSON.parse(createRequest?.body ?? '{}')).not.toHaveProperty('workspaceId');
});
