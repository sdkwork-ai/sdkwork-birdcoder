import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;
const workbenchPreferencesKey =
  'sdkwork-birdcoder.ui.v1:workbench-settings:preferences.v1';
const secondaryWorkProject = {
  id: '10002',
  projectId: 'project.e2e-work-2',
  workspaceId: 'workspace.e2e-default',
  tenantId: '0',
  organizationId: '0',
  ownerUserId: 'e2e-user-1',
  name: 'Work Provider Lab',
  description: 'Second project for Work mode project-session isolation.',
  visibility: 'private',
  status: 'active',
  driveAccessMode: 'disabled',
  defaultAgentId: 'agent.intelligence.openclaw',
  version: '1',
  createdAt: '2025-12-31T00:00:00.000Z',
  updatedAt: '2025-12-31T00:00:00.000Z',
};
const secondaryProviderSessionIdsBySessionId = new Map([
  ['e2e-secondary-openclaw-session', 'openclaw-continuation-67a1e8c3'],
  ['e2e-secondary-codex-session', 'codex-continuation-20f945bd'],
]);

function createSecondaryProjectSession({
  agentId,
  sessionId,
  title,
}: {
  agentId: string;
  sessionId: string;
  title: string;
}) {
  return {
    sessionId,
    tenantId: '0',
    organizationId: '0',
    agentId,
    ownerUserId: 'e2e-user-1',
    projectId: secondaryWorkProject.projectId,
    sessionKind: 'coding',
    entrySurface: 'pc',
    sourceModule: 'sdkwork-birdcoder',
    sourceContextKind: 'coding-project',
    sourceContextId: secondaryWorkProject.projectId,
    title,
    status: 'active',
    itemCount: '1',
    lastItemSequence: '1',
    totalInputTokens: '0',
    totalOutputTokens: '0',
    createdBy: 'e2e-user-1',
    updatedBy: 'e2e-user-1',
    version: '1',
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };
}

function createSecondarySessionRuntimeBinding(
  session: ReturnType<typeof createSecondaryProjectSession>,
) {
  const isOpenClaw = session.agentId === 'agent.intelligence.openclaw';
  const providerSessionId = secondaryProviderSessionIdsBySessionId.get(session.sessionId);
  if (!providerSessionId) {
    throw new Error(`Missing provider Session fixture for ${session.sessionId}.`);
  }
  return {
    runtimeBindingId: `runtime-binding.${session.sessionId}`,
    tenantId: session.tenantId,
    organizationId: session.organizationId,
    sessionId: session.sessionId,
    runtimeLocationId: `runtime-location.${session.sessionId}`,
    hostMode: 'web',
    transportKind: 'sdk-stream',
    providerBindingId: isOpenClaw
      ? 'binding.agent-provider.openclaw'
      : 'codex',
    modelId: isOpenClaw ? 'openclaw-default' : 'gpt-5-codex',
    providerId: isOpenClaw ? 'provider.model.openclaw' : 'openai',
    providerSessionId,
    status: 'active',
    isCurrent: true,
    version: session.version,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    activatedAt: session.createdAt,
  };
}

function createSecondarySessionActivitySummary(
  session: ReturnType<typeof createSecondaryProjectSession>,
) {
  const runtimeBinding = createSecondarySessionRuntimeBinding(session);
  return {
    session,
    latestTurn: null,
    pendingInteraction: null,
    currentRuntimeBinding: runtimeBinding,
    latestRuntimeBinding: runtimeBinding,
    userState: null,
    providerIdentity: {
      runtimeBindingId: runtimeBinding.runtimeBindingId,
      providerBindingId: runtimeBinding.providerBindingId,
      providerId: runtimeBinding.providerId,
      modelId: runtimeBinding.modelId,
      providerSessionId: runtimeBinding.providerSessionId,
      providerSessionTreeId: null,
      providerParentSessionId: null,
      providerForkedFromSessionId: null,
    },
    freshness: {
      activityAt: session.updatedAt,
      source: 'session',
      observedAt: session.updatedAt,
      freshUntil: '2099-01-01T00:00:00.000Z',
      sessionVersion: session.version,
      latestTurnVersion: null,
      latestInteractionId: null,
      latestInteractionVersion: null,
      latestRuntimeBindingId: runtimeBinding.runtimeBindingId,
      latestRuntimeBindingVersion: runtimeBinding.version,
      pendingInteractionVersion: null,
      currentRuntimeBindingVersion: runtimeBinding.version,
      userStateVersion: null,
    },
    providerActivity: {
      providerSessionId: runtimeBinding.providerSessionId,
      state: 'idle',
      freshness: 'fresh',
      evidenceKind: 'provider_event',
      interactionHint: null,
      observedAt: session.updatedAt,
      freshUntil: '2099-01-01T00:00:00.000Z',
    },
    presentationPhase: 'idle',
  };
}

async function installSecondaryWorkProject(page: Page): Promise<() => number> {
  let sessionRequestCount = 0;
  const sessions = [
    createSecondaryProjectSession({
      agentId: 'agent.intelligence.openclaw',
      sessionId: 'e2e-secondary-openclaw-session',
      title: 'Secondary OpenClaw rollout',
    }),
    createSecondaryProjectSession({
      agentId: 'agent.intelligence.codex',
      sessionId: 'e2e-secondary-codex-session',
      title: 'Secondary Codex implementation',
    }),
  ];
  const resolveSecondarySession = (url: string) => {
    const pathname = new URL(url).pathname;
    const match = /\/sessions\/(?<sessionId>e2e-secondary-[^/]+)(?:\/|$)/u.exec(pathname);
    return sessions.find((session) => session.sessionId === match?.groups?.sessionId);
  };

  await page.route('**/app/v3/api/ai/projects?**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    const response = await route.fetch();
    const payload = await response.json() as {
      data: {
        items: Array<Record<string, unknown>>;
        pageInfo: {
          totalItems?: string;
          totalPages?: number;
        };
      };
    };
    payload.data.items = payload.data.items.filter(
      (project) => project.projectId === 'project.e2e-1',
    );
    payload.data.items.push(secondaryWorkProject);
    payload.data.pageInfo.totalItems = String(payload.data.items.length);
    payload.data.pageInfo.totalPages = 1;
    await route.fulfill({ response, json: payload });
  });

  await page.route(
    new RegExp(
      `/app/v3/api/ai/projects/${secondaryWorkProject.projectId}(?:\\?.*)?$`,
      'u',
    ),
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        json: {
          code: 0,
          data: secondaryWorkProject,
          traceId: 'workbench-mode-secondary-project',
        },
      });
    },
  );

  await page.route('**/app/v3/api/ai/session_activity_summaries?**', async (route) => {
      const requestUrl = new URL(route.request().url());
      if (
        route.request().method() !== 'GET'
        || requestUrl.searchParams.get('project_id') !== secondaryWorkProject.projectId
      ) {
        await route.fallback();
        return;
      }

      sessionRequestCount += 1;
      const requestedPageSize = Number(requestUrl.searchParams.get('page_size') ?? 100);
      await route.fulfill({
        json: {
          code: 0,
          data: {
            items: sessions.map(createSecondarySessionActivitySummary),
            pageInfo: {
              hasMore: false,
              mode: 'cursor',
              nextCursor: null,
              pageSize: requestedPageSize,
            },
          },
          traceId: 'workbench-mode-secondary-project-session-activity',
        },
      });
  });
  await page.route(
    new RegExp(
      `/app/v3/api/ai/projects/${secondaryWorkProject.projectId}/sessions/e2e-secondary-[^/?]+$`,
      'u',
    ),
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      const session = resolveSecondarySession(route.request().url());
      if (!session) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        json: {
          code: 0,
          data: session,
          traceId: 'workbench-mode-secondary-project-session',
        },
      });
    },
  );
  await page.route(
    /\/app\/v3\/api\/ai\/agents\/[^/]+\/sessions\/e2e-secondary-[^/?]+$/u,
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      const session = resolveSecondarySession(route.request().url());
      if (!session) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        json: {
          code: 0,
          data: session,
          traceId: 'workbench-mode-secondary-agent-session',
        },
      });
    },
  );
  await page.route(
    /\/app\/v3\/api\/ai\/agents\/[^/]+\/sessions\/e2e-secondary-[^/]+\/items(?:\/synchronize)?(?:\?.*)?$/u,
    async (route) => {
      const requestUrl = new URL(route.request().url());
      const method = route.request().method();
      const isSynchronization = requestUrl.pathname.endsWith('/items/synchronize');
      if (
        ((isSynchronization && method !== 'POST') || (!isSynchronization && method !== 'GET'))
        || !resolveSecondarySession(route.request().url())
      ) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        json: {
          code: 0,
          data: {
            items: [],
            pageInfo: {
              hasMore: false,
              mode: 'cursor',
              nextCursor: null,
              pageSize: 50,
            },
          },
          traceId: 'workbench-mode-secondary-session-items',
        },
      });
    },
  );
  await page.route(
    /\/app\/v3\/api\/ai\/agents\/[^/]+\/sessions\/e2e-secondary-[^/]+\/interactions(?:\?.*)?$/u,
    async (route) => {
      if (route.request().method() !== 'GET' || !resolveSecondarySession(route.request().url())) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        json: {
          code: 0,
          data: {
            items: [],
            pageInfo: {
              hasMore: false,
              mode: 'offset',
              page: 1,
              pageSize: 200,
              totalItems: '0',
              totalPages: 0,
            },
          },
          traceId: 'workbench-mode-secondary-session-interactions',
        },
      });
    },
  );

  await page.route(
    /\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions\/(?<sessionId>e2e-secondary-[^/]+)\/runtime_bindings(?:\?.*)?$/u,
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }

      const pathname = new URL(route.request().url()).pathname;
      const match = /\/agents\/(?<agentId>[^/]+)\/sessions\/(?<sessionId>[^/]+)\/runtime_bindings$/u.exec(
        pathname,
      );
      const session = sessions.find((candidate) => (
        candidate.agentId === match?.groups?.agentId
        && candidate.sessionId === match.groups.sessionId
      ));
      if (!session) {
        await route.fallback();
        return;
      }

      await route.fulfill({
        json: {
          code: 0,
          data: {
            items: [createSecondarySessionRuntimeBinding(session)],
            pageInfo: {
              hasMore: false,
              mode: 'offset',
              page: 1,
              pageSize: 20,
              totalItems: '1',
              totalPages: 1,
            },
          },
          traceId: 'workbench-mode-secondary-session-runtime-binding',
        },
      });
    },
  );

  return () => sessionRequestCount;
}

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

async function readProviderIds(page: Page): Promise<string[]> {
  const trigger = page.locator('[data-sidebar-new-session-trigger="true"]');
  await trigger.hover();
  const menu = page.locator('[data-sidebar-new-session-menu="true"]');
  await expect(menu).toBeVisible();
  return menu.locator('[role="menuitemradio"] [data-provider-id]').evaluateAll(
    (elements) => elements.map((element) => element.getAttribute('data-provider-id') ?? ''),
  );
}

test('Birdcoder switches between constrained Coding and Work modes', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  const getSecondaryProjectSessionRequestCount = await installSecondaryWorkProject(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/app/code');

  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  const header = page.locator('[data-sidebar-brand-header="true"]');
  const modeTrigger = header.locator('[data-sidebar-mode-trigger="true"]');
  const searchTrigger = header.locator('[data-sidebar-search-trigger="true"]');
  const appHeader = page.locator('.birdcoder-app-header');
  await expect(header).toHaveAttribute('data-workbench-mode', 'coding');
  await expect(modeTrigger).toContainText('BirdCoder');
  await expect(appHeader.getByText('BirdCoder', { exact: true })).toBeVisible();

  const codingHeaderBox = await header.boundingBox();
  const controlMetrics = await header.evaluate((element) => {
    const mode = element.querySelector<HTMLElement>('[data-sidebar-mode-trigger="true"]');
    const search = element.querySelector<HTMLElement>('[data-sidebar-search-trigger="true"]');
    const searchIcon = search?.querySelector<SVGElement>('.lucide-search');
    if (!mode || !search || !searchIcon) {
      throw new Error('Sidebar mode and search controls must be rendered.');
    }
    return {
      brandFontSize: window.getComputedStyle(mode).fontSize,
      modeHeight: mode.getBoundingClientRect().height,
      searchHeight: search.getBoundingClientRect().height,
      searchIconWidth: searchIcon.getBoundingClientRect().width,
      searchWidth: search.getBoundingClientRect().width,
    };
  });
  expect(controlMetrics).toEqual({
    brandFontSize: '15px',
    modeHeight: 28,
    searchHeight: 28,
    searchIconWidth: 16,
    searchWidth: 28,
  });

  expect(await readProviderIds(page)).toEqual([
    'claude-code',
    'codex',
    'opencode',
    'gemini',
  ]);

  await modeTrigger.click();
  const modeMenu = page.locator('[data-sidebar-mode-menu="true"]');
  await expect(modeMenu).toBeVisible();
  await modeMenu.locator('[data-sidebar-mode-option="work"]').click();

  await expect(header).toHaveAttribute('data-workbench-mode', 'work');
  await expect(modeTrigger).toContainText('Work');
  await expect(modeTrigger).not.toContainText('BirdCoder');
  await expect(appHeader.getByText('Work', { exact: true })).toBeVisible();
  await expect(appHeader.getByText('BirdCoder', { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-work-sidebar="true"]')).toBeVisible();
  const workHeaderBox = await header.boundingBox();
  expect(workHeaderBox).toEqual(codingHeaderBox);

  const tasksSection = page.locator('[data-work-sidebar-section="tasks"]');
  const projectsSection = page.locator('[data-work-sidebar-section="projects"]');
  await expect(tasksSection.getByText('OpenClaw operations plan', { exact: true })).toBeVisible();
  await expect(tasksSection.getByText('Hermes research brief', { exact: true })).toBeVisible();
  await expect(tasksSection.getByText('Codex implementation', { exact: true })).toHaveCount(0);
  await expect(tasksSection.getByText('Claude architecture review', { exact: true })).toHaveCount(0);

  await expect(projectsSection.getByRole('button', { name: /Projects \(2\)/u })).toBeVisible();
  await expect(page.locator('[data-work-sidebar-section="spaces"]')).toHaveCount(0);
  const workProject = projectsSection.locator('[data-project-id="project.e2e-1"]');
  const secondaryProject = projectsSection.locator(
    `[data-project-id="${secondaryWorkProject.projectId}"]`,
  );
  await expect(workProject).toBeVisible();
  await expect(secondaryProject).toBeVisible();
  await expect(workProject.getByText('OpenClaw operations plan', { exact: true })).toBeVisible();
  await expect(workProject.getByText('Hermes research brief', { exact: true })).toBeVisible();
  await expect(workProject.getByText('Codex implementation', { exact: true })).toHaveCount(0);
  await expect(workProject.getByText('Claude architecture review', { exact: true })).toHaveCount(0);
  await expect(workProject.getByText('Secondary OpenClaw rollout', { exact: true })).toHaveCount(0);
  await expect(secondaryProject.getByText('OpenClaw operations plan', { exact: true })).toHaveCount(0);
  await expect(
    secondaryProject.getByText('Secondary OpenClaw rollout', { exact: true }),
  ).toHaveCount(0);
  expect(getSecondaryProjectSessionRequestCount()).toBe(0);

  const expandSecondaryProject = secondaryProject.getByRole('button', {
    name: `Expand ${secondaryWorkProject.name}`,
  });
  await expect(expandSecondaryProject).toHaveAttribute('aria-expanded', 'false');
  await expandSecondaryProject.click();
  await expect.poll(getSecondaryProjectSessionRequestCount).toBe(1);
  await expect(
    secondaryProject.getByText('Secondary OpenClaw rollout', { exact: true }),
  ).toBeVisible();
  await expect(
    secondaryProject.getByText('Secondary Codex implementation', { exact: true }),
  ).toHaveCount(0);
  await expect(secondaryProject.getByText('OpenClaw operations plan', { exact: true })).toHaveCount(0);
  expect(getSecondaryProjectSessionRequestCount()).toBe(1);

  await secondaryProject.getByRole('button', {
    name: `Collapse ${secondaryWorkProject.name}`,
  }).click();
  await expect(
    secondaryProject.getByText('Secondary OpenClaw rollout', { exact: true }),
  ).toBeHidden();
  await secondaryProject.getByRole('button', {
    name: `Expand ${secondaryWorkProject.name}`,
  }).click();
  await expect(
    secondaryProject.getByText('Secondary OpenClaw rollout', { exact: true }),
  ).toBeVisible();
  expect(getSecondaryProjectSessionRequestCount()).toBe(1);

  await secondaryProject.getByRole('button', {
    name: secondaryWorkProject.name,
    exact: true,
  }).click();
  await expect(secondaryProject).toHaveAttribute('data-project-selected', 'true');
  await expect(workProject).not.toHaveAttribute('data-project-selected', 'true');
  await expect(
    secondaryProject.getByText('Secondary OpenClaw rollout', { exact: true }),
  ).toBeVisible();

  const secondarySessionRow = secondaryProject.locator(
    '[data-agent-session-id="e2e-secondary-openclaw-session"]',
  );
  await secondarySessionRow.getByRole('button', {
    name: /Secondary OpenClaw rollout \| Work Provider Lab \|/u,
  }).click();
  await expect(secondarySessionRow).toHaveAttribute('data-session-selected', 'true');
  await expect(page.locator('[data-code-page-title="true"]')).toContainText(
    'Secondary OpenClaw rollout',
  );
  expect(getSecondaryProjectSessionRequestCount()).toBe(1);
  expect(await readProviderIds(page)).toEqual(['openclaw', 'hermes']);

  await expect.poll(() => page.evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as { workbenchMode?: unknown }).workbenchMode : null;
  }, workbenchPreferencesKey)).toBe('work');

  await page.reload();
  await expect(page.locator('[data-sidebar-brand-header="true"]')).toHaveAttribute(
    'data-workbench-mode',
    'work',
    { timeout: 60_000 },
  );
  await expect(page.locator('[data-sidebar-mode-trigger="true"]')).toContainText('Work');
  await expect(page.locator('.birdcoder-app-header').getByText('Work', { exact: true })).toBeVisible();
  await expect(page.locator('[data-work-sidebar="true"]')).toBeVisible();

  await page.mouse.move(800, 100);
  await expect(page.locator('[data-sidebar-new-session-menu="true"]')).toHaveCount(0);
  await page.locator('[data-work-navigation-item="expert-tools"]').click();
  await expect(page.getByRole('heading', { name: 'Work resources', level: 1 })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Experts' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Skills' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Connectors' })).toBeVisible();
});
