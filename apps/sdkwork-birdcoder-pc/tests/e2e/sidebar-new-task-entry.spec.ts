import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;
const projectSessionsPath = '/app/v3/api/ai/projects/project.e2e-1/sessions';

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

test('sidebar new-task entry matches the navigation-row interaction', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  const sessionCreateBodies: Record<string, unknown>[] = [];
  const pinnedUpdates: boolean[] = [];
  await page.route(`**${projectSessionsPath}`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    sessionCreateBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.abort();
  });
  await page.route(
    /\/app\/v3\/api\/ai\/agents\/agent\.intelligence\.codex\/sessions\/e2e-codex-session\/user_state$/u,
    async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.fallback();
        return;
      }

      const requestBody = route.request().postDataJSON() as { pinned?: boolean };
      const response = await route.fetch();
      const payload = await response.json() as {
        data: { item: Record<string, unknown> };
      };
      const isPinned = requestBody.pinned === true;
      pinnedUpdates.push(isPinned);
      payload.data.item.pinnedAt = isPinned ? payload.data.item.updatedAt : undefined;
      await route.fulfill({ response, json: payload });
    },
  );

  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });

  const pinnedSection = page.locator('[data-sidebar-pinned-section="true"]');
  await expect(pinnedSection.locator('[data-sidebar-pinned-label="true"]')).toHaveText('Pinned');
  await expect(
    pinnedSection.getByText('Claude architecture review', { exact: true }),
  ).toBeVisible();
  const brandHeader = page.locator('[data-sidebar-brand-header="true"]');
  await expect(brandHeader).toContainText('Birdcoder');
  const sidebarSearchTrigger = brandHeader.locator('[data-sidebar-search-trigger="true"]');
  await expect(sidebarSearchTrigger).toHaveAccessibleName('Search tasks');
  await expect(sidebarSearchTrigger.locator('.lucide-search')).toHaveCount(1);
  const pinnedSessionRow = pinnedSection.locator(
    '[data-session-row-variant="pinned"][data-agent-session-id="e2e-claude-session"]',
  );
  await expect(pinnedSessionRow).toBeVisible();
  await expect(pinnedSessionRow.locator('[data-session-provider-badge="leading"]')).toHaveCount(0);
  await expect(pinnedSessionRow.locator('.lucide-pin')).toHaveCount(0);
  await expect(pinnedSessionRow.locator('[data-session-trailing-metadata="true"]')).toHaveCount(0);
  const projectsHeader = page.locator('[data-sidebar-projects-header="true"]');
  await expect(projectsHeader).toContainText('Projects');
  const addProjectTrigger = projectsHeader.locator('[data-sidebar-add-project-trigger="true"]');
  await expect(addProjectTrigger).toHaveAccessibleName('New Project');
  await expect(addProjectTrigger.locator('.lucide-plus')).toHaveCount(1);
  await expect.poll(() => addProjectTrigger.evaluate(
    (element) => element === element.parentElement?.lastElementChild,
  )).toBe(true);
  await expect(projectsHeader.locator('.lucide-folder, .lucide-folder-plus')).toHaveCount(0);
  await addProjectTrigger.click();
  const createProjectDialog = page.getByRole('dialog', { name: 'Create project' });
  await expect(createProjectDialog).toBeVisible();
  await expect(
    createProjectDialog.getByRole('button', {
      name: 'Add a folder BirdCoder can read and edit',
    }),
  ).toBeVisible();
  await createProjectDialog.getByRole('button', { name: 'Close Create project dialog' }).click();
  await expect(createProjectDialog).toHaveCount(0);
  const sidebarSectionOrder = await page.locator([
    '[data-sidebar-brand-header="true"]',
    '[data-sidebar-new-session-entry="true"]',
    '[data-sidebar-pinned-section="true"]',
    '[data-sidebar-projects-header="true"]',
  ].join(',')).evaluateAll((elements) => elements.map((element) => {
    if (element.hasAttribute('data-sidebar-brand-header')) {
      return 'brand';
    }
    if (element.hasAttribute('data-sidebar-new-session-entry')) {
      return 'new-task';
    }
    if (element.hasAttribute('data-sidebar-pinned-section')) {
      return 'pinned';
    }
    return 'projects';
  }));
  expect(sidebarSectionOrder).toEqual(['brand', 'new-task', 'pinned', 'projects']);

  const projectSessionList = page.locator('.project-explorer-scroll-region').last();
  const codexProjectRow = projectSessionList.locator(
    '[data-session-row-variant="default"][data-agent-session-id="e2e-codex-session"]',
  );
  await expect(codexProjectRow).toBeVisible();
  await codexProjectRow.click({ button: 'right' });
  await page.getByRole('button', { name: 'Pin session' }).click();
  const codexPinnedRow = pinnedSection.locator(
    '[data-session-row-variant="pinned"][data-agent-session-id="e2e-codex-session"]',
  );
  await expect(codexPinnedRow).toBeVisible();
  await codexPinnedRow.click({ button: 'right' });
  await page.getByRole('button', { name: 'Unpin session' }).click();
  await expect(codexPinnedRow).toHaveCount(0);
  expect(pinnedUpdates).toEqual([true, false]);

  const newTaskTrigger = page.locator('[data-sidebar-new-session-trigger="true"]');
  await expect(newTaskTrigger).toHaveCount(1);
  await expect(newTaskTrigger).toHaveAccessibleName('New task');
  const triggerVisualState = await newTaskTrigger.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderWidths: [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ],
      hasChevron: element.querySelector('.lucide-chevron-down') !== null,
      hasProviderIcon: element.querySelector('[data-provider-id]') !== null,
      hasTaskIcon: element.querySelector('.lucide-square-pen') !== null,
    };
  });
  expect(triggerVisualState).toEqual({
    backgroundColor: 'rgba(0, 0, 0, 0)',
    borderWidths: ['0px', '0px', '0px', '0px'],
    hasChevron: false,
    hasProviderIcon: false,
    hasTaskIcon: true,
  });

  await newTaskTrigger.hover();
  const providerMenu = page.locator('[data-sidebar-new-session-menu="true"]');
  await expect(providerMenu).toBeVisible();
  const providerOptions = providerMenu.getByRole('menuitemradio');
  expect(await providerOptions.count()).toBeGreaterThan(1);
  const defaultProviderOption = providerMenu.locator(
    '[role="menuitemradio"][aria-checked="true"]',
  );
  await expect(defaultProviderOption).toHaveCount(1);
  const defaultProviderId = await defaultProviderOption
    .locator('[data-provider-id]')
    .getAttribute('data-provider-id');
  if (!defaultProviderId) {
    throw new Error('The default new-task Provider option must expose its Provider id.');
  }

  const createRequest = page.waitForRequest((candidate) => (
    candidate.method() === 'POST'
      && new URL(candidate.url()).pathname === projectSessionsPath
  ));
  await newTaskTrigger.click();
  await createRequest;

  expect(sessionCreateBodies).toHaveLength(1);
  expect(sessionCreateBodies[0]).toMatchObject({
    agentId: `agent.${defaultProviderId}`,
  });
  await expect(providerMenu).toHaveCount(0);
});
