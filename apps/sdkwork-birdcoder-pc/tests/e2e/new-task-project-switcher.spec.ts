import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;

const secondProject = {
  id: '10002',
  projectId: 'project.e2e-2',
  workspaceId: 'workspace.e2e-default',
  tenantId: '0',
  organizationId: '0',
  ownerUserId: 'e2e-user-1',
  name: 'BirdCoder Sandbox',
  description: 'Second project for the new-task project switcher.',
  visibility: 'private',
  status: 'active',
  driveAccessMode: 'disabled',
  defaultAgentId: 'agent.codex',
  version: '1',
  createdAt: '2025-12-31T00:00:00.000Z',
  updatedAt: '2025-12-31T00:00:00.000Z',
};

function createSwitchSession(agentId: string) {
  return {
    sessionId: 'session.e2e-project-switcher',
    tenantId: '0',
    organizationId: '0',
    agentId,
    ownerUserId: 'e2e-user-1',
    projectId: 'project.e2e-1',
    sessionKind: 'coding',
    entrySurface: 'pc',
    sourceModule: 'sdkwork-birdcoder',
    sourceContextKind: 'coding-project',
    sourceContextId: 'project.e2e-1',
    title: 'New task',
    status: 'active',
    itemCount: '0',
    lastItemSequence: '0',
    totalInputTokens: '0',
    totalOutputTokens: '0',
    createdBy: 'e2e-user-1',
    updatedBy: 'e2e-user-1',
    version: '1',
    createdAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
  };
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

async function installSecondProject(page: Page): Promise<void> {
  await page.route(
    /\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions\/session\.e2e-project-switcher\/(?:checkpoints|interactions|items|runtime_bindings|turns)(?:\?.*)?$/u,
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }

      const requestUrl = new URL(route.request().url());
      const resourceKind = requestUrl.pathname.split('/').at(-1);
      const pageNumber = Number(requestUrl.searchParams.get('page') ?? 1);
      const pageSize = Number(requestUrl.searchParams.get('page_size') ?? 20);
      await route.fulfill({
        json: {
          code: 0,
          data: {
            items: [],
            pageInfo: resourceKind === 'items'
              ? {
                  hasMore: false,
                  mode: 'cursor',
                  nextCursor: null,
                  pageSize,
                }
              : {
                  hasMore: false,
                  mode: 'offset',
                  page: pageNumber,
                  pageSize,
                  totalItems: '0',
                  totalPages: 0,
                },
          },
          traceId: 'new-task-project-switcher-session-resources',
        },
      });
    },
  );

  await page.route(
    /\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions\/session\.e2e-project-switcher$/u,
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }

      const match = /\/agents\/(?<agentId>[^/]+)\/sessions\//u.exec(
        new URL(route.request().url()).pathname,
      );
      await route.fulfill({
        json: {
          code: 0,
          data: createSwitchSession(decodeURIComponent(match?.groups?.agentId ?? 'agent.codex')),
          traceId: 'new-task-project-switcher-session-detail',
        },
      });
    },
  );

  await page.route(
    '**/app/v3/api/ai/agents/*/sessions/session.e2e-project-switcher/runtime_bindings',
    async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }

      const body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        json: {
          code: 0,
          data: {
            runtimeBindingId: 'runtime-binding.e2e-project-switcher',
            tenantId: '0',
            organizationId: '0',
            sessionId: 'session.e2e-project-switcher',
            ...body,
            status: 'active',
            isCurrent: true,
            version: '1',
            createdAt: '2026-01-03T00:00:00.000Z',
            updatedAt: '2026-01-03T00:00:00.000Z',
            activatedAt: '2026-01-03T00:00:00.000Z',
          },
          traceId: 'new-task-project-switcher-runtime-binding',
        },
      });
    },
  );

  await page.route('**/app/v3/api/ai/projects/project.e2e-1/sessions', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const body = route.request().postDataJSON() as Record<string, unknown>;
    const session = createSwitchSession(String(body.agentId ?? 'agent.codex'));
    await route.fulfill({
      json: {
        code: 0,
        data: {
          ...session,
          sourceContextKind: body.sourceContextKind,
          sourceContextId: body.sourceContextId,
          title: body.title,
        },
        traceId: 'new-task-project-switcher-session',
      },
    });
  });
  await page.route(
    '**/app/v3/api/ai/projects/project.e2e-1/sessions/session.e2e-project-switcher',
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        json: {
          code: 0,
          data: createSwitchSession('agent.intelligence.claude-code'),
          traceId: 'new-task-project-switcher-project-session-detail',
        },
      });
    },
  );

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
    if (!payload.data.items.some((item) => item.projectId === secondProject.projectId)) {
      payload.data.items.push(secondProject);
    }
    payload.data.pageInfo.totalItems = String(payload.data.items.length);
    payload.data.pageInfo.totalPages = 1;
    await route.fulfill({ response, json: payload });
  });

  await page.route(`**/app/v3/api/ai/projects/${secondProject.projectId}`, (route) => route.fulfill({
    json: {
      code: 0,
      data: secondProject,
      traceId: 'new-task-project-switcher-project',
    },
  }));

  await page.route(`**/app/v3/api/ai/projects/${secondProject.projectId}/sessions?**`, (route) => (
    route.fulfill({
      json: {
        code: 0,
        data: {
          items: [],
          pageInfo: {
            hasMore: false,
            mode: 'offset',
            page: 1,
            pageSize: 20,
            totalItems: '0',
            totalPages: 0,
          },
        },
        traceId: 'new-task-project-switcher-sessions',
      },
    })
  ));
}

test('new-task project context searches and switches projects', async ({
  page,
  request,
}, testInfo) => {
  await bootstrapAuthenticatedSession(page, request);
  await installSecondProject(page);
  await page.setViewportSize({ width: 1_280, height: 760 });
  await page.goto('/#/app/code');

  const newTaskButton = page.locator('[data-sidebar-new-session-trigger="true"]');
  await expect(newTaskButton).toBeVisible({ timeout: 60_000 });
  await newTaskButton.click();

  const newSessionContext = page.locator('[data-new-session-context="true"]');
  const projectSwitcherTrigger = page.locator(
    '[data-new-task-project-switcher-trigger="true"]',
  );
  await expect(newSessionContext).toBeVisible();
  await expect(projectSwitcherTrigger).toHaveAccessibleName('Switch project');
  await expect(projectSwitcherTrigger).toContainText('E2E Project');

  await projectSwitcherTrigger.click();
  const projectSwitcher = page.getByRole('dialog', { name: 'Switch project' });
  const projectSearch = projectSwitcher.getByRole('searchbox', { name: 'Search projects' });
  await expect(projectSwitcher).toBeVisible();
  await expect(projectSearch).toBeFocused();
  await expect(projectSwitcher.getByRole('option', { name: 'E2E Project' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(projectSwitcher.getByRole('option', { name: 'BirdCoder Sandbox' })).toBeVisible();

  await projectSearch.fill('sandbox');
  await expect(projectSwitcher.getByRole('option', { name: 'E2E Project' })).toHaveCount(0);
  await projectSwitcher.getByRole('option', { name: 'BirdCoder Sandbox' }).click();

  await expect(projectSwitcher).toHaveCount(0);
  await expect(projectSwitcherTrigger).toContainText('BirdCoder Sandbox');
  await expect(newSessionContext).toBeVisible();
  await expect(page.locator('[data-new-session-composer="true"] textarea')).toBeVisible();

  await projectSwitcherTrigger.click();
  await projectSearch.fill('missing project');
  await expect(projectSwitcher.getByText('No matching projects')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(projectSwitcher).toHaveCount(0);

  await page.setViewportSize({ width: 520, height: 640 });
  await projectSwitcherTrigger.click();
  const projectSwitcherBox = await projectSwitcher.boundingBox();
  expect(projectSwitcherBox).not.toBeNull();
  expect(projectSwitcherBox?.x).toBeGreaterThanOrEqual(0);
  expect((projectSwitcherBox?.x ?? 0) + (projectSwitcherBox?.width ?? 0)).toBeLessThanOrEqual(520);
  expect(projectSwitcherBox?.y).toBeGreaterThanOrEqual(0);
  expect((projectSwitcherBox?.y ?? 0) + (projectSwitcherBox?.height ?? 0)).toBeLessThanOrEqual(640);

  await page.screenshot({
    path: testInfo.outputPath('new-task-project-switcher-narrow.png'),
    fullPage: true,
  });

  await projectSwitcher.getByRole('button', { name: 'New Project' }).click();
  await expect(projectSwitcher).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Create project' })).toBeVisible();
});
