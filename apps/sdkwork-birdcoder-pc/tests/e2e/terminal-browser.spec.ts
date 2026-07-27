import { expect, test, type Page, type Route } from '@playwright/test';

function createE2eJwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ token_version: 1, ...claims })).toString('base64url');
  return `${header}.${payload}.signature`;
}

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

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/^\/app\/v3\/api\/(?:workspaces|projects)(?:\/|$)/u.test(url.pathname)) {
      legacyProjectRequests.push(url.pathname);
    }
    if (url.pathname.startsWith('/app/v3/api/device/terminal/')) {
      terminalRequests.push(url.pathname);
    }
  });

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
        environment: 'test',
        deploymentMode: 'private',
        sessionId: 'e2e-session-1',
        tenantId: '0',
        organizationId: '0',
      },
    }));
  }, { accessToken, authToken });

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
  const project = {
    id: '10001',
    projectId: 'project.e2e-terminal',
    workspaceId: 'workspace.e2e-default',
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
  const workspace = {
    id: '9001',
    workspaceId: project.workspaceId,
    tenantId: '0',
    organizationId: '0',
    ownerUserId: '1',
    name: 'Default Workspace',
    description: 'Browser terminal Workspace fixture.',
    isDefault: true,
    status: 'active',
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
  await page.route('**/app/v3/api/ai/workspaces/default', (route) => route.fulfill({
    json: itemEnvelope(workspace),
  }));
  await page.route('**/app/v3/api/ai/workspaces?**', (route) => route.fulfill({
    json: pageEnvelope(route, [workspace]),
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

test('Browser terminal creates a remote session from the current Agents runtime binding', async ({
  page,
}, testInfo) => {
  const terminalCreateBodies: Record<string, unknown>[] = [];
  const runtimeBindingRequests: string[] = [];
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
  const project = {
    id: '10002',
    projectId: 'project.e2e-terminal-ready',
    workspaceId: 'workspace.e2e-terminal-ready',
    tenantId: '0',
    organizationId: '0',
    ownerUserId: '1',
    name: 'Terminal Ready Project',
    description: 'Browser terminal positive fixture.',
    visibility: 'private',
    status: 'active',
    driveAccessMode: 'disabled',
    defaultAgentId: 'agent.birdcoder',
    version: '1',
    createdAt: '2026-07-15T12:00:00.000Z',
    updatedAt: '2026-07-15T12:00:00.000Z',
  };
  const workspace = {
    id: '9002',
    workspaceId: project.workspaceId,
    tenantId: '0',
    organizationId: '0',
    ownerUserId: '1',
    name: 'Terminal Ready Workspace',
    description: 'Browser terminal positive Workspace fixture.',
    isDefault: true,
    status: 'active',
    version: '1',
    createdAt: '2026-07-15T12:00:00.000Z',
    updatedAt: '2026-07-15T12:00:00.000Z',
  };
  const agentSession = {
    sessionId: 'session.e2e-terminal-ready',
    tenantId: '0',
    organizationId: '0',
    agentId: 'agent.birdcoder',
    ownerUserId: '1',
    projectId: project.projectId,
    sessionKind: 'coding',
    entrySurface: 'pc',
    sourceModule: 'sdkwork-birdcoder',
    sourceContextKind: 'coding-project',
    sourceContextId: project.projectId,
    title: 'Terminal Ready Session',
    status: 'active',
    itemCount: '0',
    lastItemSequence: '0',
    totalInputTokens: '0',
    totalOutputTokens: '0',
    createdBy: '1',
    updatedBy: '1',
    version: '1',
    createdAt: '2026-07-15T12:00:00.000Z',
    updatedAt: '2026-07-15T12:00:00.000Z',
  };
  const runtimeBinding = {
    runtimeBindingId: 'runtime-binding.e2e-terminal-ready',
    tenantId: '0',
    organizationId: '0',
    sessionId: agentSession.sessionId,
    runtimeLocationId: 'runtime-location.e2e-terminal-ready',
    hostMode: 'server',
    transportKind: 'runtime-node',
    providerBindingId: 'provider-binding.e2e-terminal-ready',
    modelId: 'gpt-5',
    providerId: 'openai',
    status: 'active',
    isCurrent: true,
    version: '1',
    createdAt: '2026-07-15T12:00:00.000Z',
    updatedAt: '2026-07-15T12:00:00.000Z',
  };
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
        environment: 'test',
        deploymentMode: 'private',
        sessionId: 'e2e-session-1',
        tenantId: '0',
        organizationId: '0',
      },
    }));
  }, { accessToken, authToken });
  await page.route('**/app/v3/api/auth/sessions/current', (route) => route.fulfill({
    json: { code: 0, data: authenticatedSession, traceId: 'terminal-ready-auth-session' },
  }));
  await page.route('**/app/v3/api/iam/users/current', (route) => route.fulfill({
    json: { code: 0, data: authenticatedSession.user, traceId: 'terminal-ready-user' },
  }));
  await page.route('**/app/v3/api/ai/workspaces/default', (route) => route.fulfill({
    json: itemEnvelope(workspace),
  }));
  await page.route('**/app/v3/api/ai/workspaces?**', (route) => route.fulfill({
    json: pageEnvelope(route, [workspace]),
  }));
  await page.route('**/app/v3/api/ai/projects?**', (route) => route.fulfill({
    json: pageEnvelope(route, [project]),
  }));
  await page.route('**/app/v3/api/ai/projects/project.e2e-terminal-ready', (route) =>
    route.fulfill({ json: itemEnvelope(project) }));
  await page.route('**/app/v3/api/ai/agents/agent.birdcoder/sessions?**', (route) =>
    route.fulfill({ json: pageEnvelope(route, [agentSession]) }));
  await page.route(
    '**/app/v3/api/ai/projects/project.e2e-terminal-ready/sessions?**',
    (route) => route.fulfill({ json: pageEnvelope(route, [agentSession]) }),
  );
  await page.route(
    '**/app/v3/api/ai/agents/agent.birdcoder/sessions/session.e2e-terminal-ready',
    (route) => route.fulfill({ json: itemEnvelope(agentSession) }),
  );
  await page.route(
    /\/app\/v3\/api\/ai\/agents\/agent\.birdcoder\/sessions\/session\.e2e-terminal-ready\/runtime_bindings(?:\?.*)?$/,
    (route) => {
      runtimeBindingRequests.push(route.request().url());
      return route.fulfill({ json: pageEnvelope(route, [runtimeBinding]) });
    },
  );
  await page.route(
    '**/app/v3/api/ai/agents/agent.birdcoder/sessions/user_states?**',
    (route) => route.fulfill({
      json: pageEnvelope(route, [{
        id: '7002',
        tenantId: '0',
        organizationId: '0',
        userId: '1',
        resourceType: 'session',
        resourceId: agentSession.sessionId,
        version: '1',
        createdAt: '2026-07-15T12:00:00.000Z',
        updatedAt: '2026-07-15T12:00:00.000Z',
      }]),
    }),
  );
  await page.route(
    /\/app\/v3\/api\/ai\/agents\/agent\.birdcoder\/sessions\/session\.e2e-terminal-ready\/(?:checkpoints|interactions|items|turns)(?:\?.*)?$/,
    (route) => route.fulfill({ json: pageEnvelope(route, []) }),
  );

  await page.route('**/app/v3/api/device/terminal/sessions', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: { code: 0, data: { sessions: [], attachments: [] }, traceId: 'terminal-index' },
      });
      return;
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    terminalCreateBodies.push(body);
    await route.fulfill({
      json: itemEnvelope({
        sessionId: 'terminal-session.e2e-ready',
        projectId: project.projectId,
        runtimeLocationId: runtimeBinding.runtimeLocationId,
        target: 'server-runtime-node',
        state: 'running',
        createdAt: '2026-07-15T12:00:01.000Z',
        lastActiveAt: '2026-07-15T12:00:01.000Z',
        modeTags: ['cli-native'],
        tags: ['profile:bash'],
        attachmentId: 'terminal-attachment.e2e-ready',
        cursor: '1',
        lastAckSequence: 1,
        writable: true,
        invokedProgram: '/bin/bash',
        invokedArgs: ['-l'],
        replayEntry: {
          sequence: 1,
          kind: 'output',
          payload: 'BirdCoder remote terminal ready\r\n',
          occurredAt: '2026-07-15T12:00:01.000Z',
        },
      }),
    });
  });
  await page.route('**/app/v3/api/device/terminal/sessions/terminal-session.e2e-ready/replay?**',
    (route) => route.fulfill({
      json: itemEnvelope({
        sessionId: 'terminal-session.e2e-ready',
        fromCursor: '1',
        nextCursor: '1',
        hasMore: false,
        entries: [],
      }),
    }));
  await page.route('**/app/v3/api/device/terminal/sessions/terminal-session.e2e-ready/resize',
    async (route) => {
      const body = route.request().postDataJSON() as { cols?: number; rows?: number };
      await route.fulfill({
        json: itemEnvelope({
          sessionId: 'terminal-session.e2e-ready',
          cols: body.cols ?? 120,
          rows: body.rows ?? 32,
        }),
      });
    });
  await page.route('**/app/v3/api/device/terminal/sessions/terminal-session.e2e-ready/events',
    (route) => route.fulfill({
      body: '',
      contentType: 'text/event-stream',
      status: 200,
    }));

  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => {
        sessionStorage.setItem('birdcoder.e2e.project-terminal-folder-picker-called', 'true');
        throw new Error('Project terminal actions must not open the browser folder picker.');
      },
    });
  });
  await page.goto('/#/app/code');
  await expect(page.getByText('Terminal Ready Project').first()).toBeVisible({ timeout: 45_000 });
  const selectedProjectRow = page.locator('.birdcoder-session-row').filter({
    hasText: project.name,
  });
  await expect(selectedProjectRow).toHaveCount(1);
  await selectedProjectRow.click({ button: 'right' });
  const openInTerminalAction = page.getByRole('button', {
    exact: true,
    name: 'Open in Terminal',
  });
  await expect(openInTerminalAction).toBeVisible();
  await openInTerminalAction.click();
  await expect.poll(() => runtimeBindingRequests.length, { timeout: 30_000 }).toBeGreaterThan(0);

  await expect(page.locator('[data-shell-layout="terminal-tabs"]')).toBeVisible({
    timeout: 30_000,
  });
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem('birdcoder.e2e.project-terminal-folder-picker-called')),
  ).toBeNull();
  await expect.poll(() => terminalCreateBodies.length, { timeout: 30_000 }).toBe(1);
  expect(terminalCreateBodies[0]).toMatchObject({
    projectId: project.projectId,
    runtimeLocationId: runtimeBinding.runtimeLocationId,
    command: ['/bin/bash', '-l'],
  });
  expect(terminalCreateBodies[0]).not.toHaveProperty('path');
  expect(terminalCreateBodies[0]).not.toHaveProperty('workingDirectory');
  await expect(page.locator('[data-shell-layout="terminal-runtime-unavailable"]')).toHaveCount(0);

  await page.locator('.birdcoder-app-sidebar button[title="Code"]').click();
  await page.locator('.birdcoder-workbench-header button[aria-label="Terminal"]').click();
  await expect(page.getByRole('button', { name: 'Close terminal' })).toBeVisible();
  await expect(page.getByText(
    'The current project does not have a recoverable local path on this desktop.',
  )).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem('birdcoder.e2e.project-terminal-folder-picker-called')),
  ).toBeNull();

  await page.getByRole('button', { name: 'Close terminal' }).click();
  await page.keyboard.press('Control+Shift+Backquote');
  await expect(
    page.locator('.birdcoder-app-sidebar button[title="Terminal"]'),
  ).toHaveClass(/bg-white\/10/);
  await expect(page.locator('[data-shell-layout="terminal-tabs"]')).toBeVisible();
  await expect(page.getByText(
    'The current project does not have a recoverable local path on this desktop.',
  )).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem('birdcoder.e2e.project-terminal-folder-picker-called')),
  ).toBeNull();

  await page.screenshot({
    path: testInfo.outputPath('birdcoder-browser-terminal-ready.png'),
    fullPage: true,
  });
  await unloadPageForTeardown(page);
});
