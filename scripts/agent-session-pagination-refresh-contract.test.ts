import assert from 'node:assert/strict';

import type {
  AgentProjectView,
  AgentSessionView,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';
import type {
  AgentSessionPageRequest,
  AgentSessionReadOptions,
  IAgentSessionService,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IAgentSessionService.ts';
import { canLoadMoreProjectSessions } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/ProjectExplorer.shared.ts';
import {
  loadCompleteProjectAgentSessionInventory,
  loadProjectAgentSessionPage,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/agentSessionViewModels.ts';
import {
  buildProjectsStoreScopeKey,
  deleteProjectsStore,
  getProjectsStore,
  upsertAgentSessionIntoProjectsStore,
  upsertProjectIntoProjectsStore,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/stores/projectsStore.ts';
import {
  loadEarlierAgentSessionItems,
  refreshAgentSessionItems,
  refreshProjectSessions,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/sessionRefresh.ts';

function buildSession(index: number, projectId = 'project.pagination') {
  const timestamp = new Date(Date.UTC(2026, 6, 24, 0, 0, index)).toISOString();
  return {
    sessionId: `session.pagination.${index}`,
    projectId,
    sessionKind: 'coding',
    status: 'active',
    title: `Session ${index}`,
    lastItemSequence: String(index),
    createdAt: timestamp,
    updatedAt: timestamp,
    lastItemAt: timestamp,
  };
}

function buildSessionUserState(sessionId: string) {
  return {
    id: `user-state.${sessionId}`,
    tenantId: '1001',
    organizationId: '2001',
    userId: '3001',
    resourceType: 'session',
    resourceId: sessionId,
    version: '1',
    createdAt: '2026-07-24T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
    lastReadItemSequence: '0',
  };
}

function buildEmptyRuntimeBindingsPage() {
  return {
    items: [],
    pageInfo: { mode: 'offset' as const, page: 1, pageSize: 20, hasMore: false },
  };
}

function buildProject(): AgentProjectView {
  return {
    projectId: 'project.pagination',
    tenantId: '1001',
    organizationId: '2001',
    ownerUserId: '3001',
    name: 'Pagination project',
    visibility: 'private',
    status: 'active',
    driveAccessMode: 'disabled',
    version: '1',
    createdAt: '2026-07-24T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
    agentSessions: [],
  };
}

const requestedSessionPages: AgentSessionPageRequest[] = [];
const paginatedService = {
  async listSessions(request: AgentSessionPageRequest = {}) {
    requestedSessionPages.push(request);
    const page = request.page ?? 1;
    const start = (page - 1) * 20;
    return {
      items: Array.from({ length: 20 }, (_, index) => buildSession(start + index + 1)),
      pageInfo: {
        mode: 'offset',
        page,
        pageSize: 20,
        hasMore: page < 3,
      },
    };
  },
  async listRuntimeBindings() {
    return buildEmptyRuntimeBindingsPage();
  },
  async getSessionUserState(sessionId: string) {
    return buildSessionUserState(sessionId);
  },
} as unknown as IAgentSessionService;

const firstPage = await loadProjectAgentSessionPage(paginatedService, buildProject(), 5);
assert.equal(firstPage.project.agentSessions.length, 20);
assert.deepEqual(firstPage.project.agentSessionPageInfo, {
  page: 1,
  pageSize: 20,
  hasMore: true,
});

const missingUserStateService = {
  async listSessions() {
    return {
      items: [
        {
          ...buildSession(101),
          agentId: 'agent.code-engine.codex',
          title: 'State-free active session',
        },
        {
          ...buildSession(102),
          agentId: 'agent.code-engine.codex',
          status: 'archived',
          title: 'State-free archived session',
        },
      ],
      pageInfo: { mode: 'offset', page: 1, pageSize: 20, hasMore: false },
    };
  },
  async listRuntimeBindings() {
    return buildEmptyRuntimeBindingsPage();
  },
  async getSessionUserState() {
    return null;
  },
} as unknown as IAgentSessionService;
const missingUserStatePage = await loadProjectAgentSessionPage(
  missingUserStateService,
  buildProject(),
  2,
);
const stateFreeActiveSession = missingUserStatePage.project.agentSessions[0];
const stateFreeArchivedSession = missingUserStatePage.project.agentSessions[1];
assert.equal(stateFreeActiveSession?.title, 'State-free active session');
assert.equal(stateFreeActiveSession?.pinned, false);
assert.equal(stateFreeActiveSession?.archived, false);
assert.equal(stateFreeActiveSession?.unread, false);
assert.equal(stateFreeArchivedSession?.title, 'State-free archived session');
assert.equal(stateFreeArchivedSession?.pinned, false);
assert.equal(stateFreeArchivedSession?.archived, true);
assert.equal(stateFreeArchivedSession?.unread, false);

const cachedPrefix = await loadProjectAgentSessionPage(
  paginatedService,
  firstPage.project,
  15,
);
assert.equal(cachedPrefix.project, firstPage.project);
assert.equal(requestedSessionPages.length, 1, 'a cached visible prefix must not re-fetch page one');

const secondPage = await loadProjectAgentSessionPage(
  paginatedService,
  firstPage.project,
  25,
);
assert.deepEqual(requestedSessionPages.map((request) => request.page), [1, 2]);
assert.equal(secondPage.project.agentSessions.length, 40);
assert.equal(secondPage.project.agentSessionPageInfo?.page, 2);
assert.equal(secondPage.hasMore, true);
assert.equal(
  secondPage.project.agentSessions.find((session) => session.id === 'session.pagination.1'),
  firstPage.project.agentSessions[0],
  'appending a server page must preserve existing Session object identity',
);

const shortPageProject = {
  ...buildProject(),
  agentSessionPageInfo: { page: 1, pageSize: 20, hasMore: true },
  agentSessions: firstPage.project.agentSessions.slice(0, 3),
};
assert.equal(
  canLoadMoreProjectSessions(shortPageProject, 5),
  true,
  'Project, provider, and chronological views must continue from server hasMore',
);
assert.equal(
  canLoadMoreProjectSessions({
    ...shortPageProject,
    agentSessionPageInfo: { page: 2, pageSize: 20, hasMore: false },
  }, 5),
  false,
);

const duplicatePageService = {
  async listSessions(request: AgentSessionPageRequest = {}) {
    return {
      items: [buildSession(20), ...Array.from({ length: 19 }, (_, index) => buildSession(41 + index))],
      pageInfo: { mode: 'offset', page: request.page, pageSize: 20, hasMore: false },
    };
  },
  async listRuntimeBindings() {
    return buildEmptyRuntimeBindingsPage();
  },
  async getSessionUserState(sessionId: string) {
    return buildSessionUserState(sessionId);
  },
} as unknown as IAgentSessionService;
const deduplicatedPage = await loadProjectAgentSessionPage(
  duplicatePageService,
  secondPage.project,
  45,
);
assert.equal(deduplicatedPage.project.agentSessions.length, 59);
assert.equal(new Set(deduplicatedPage.project.agentSessions.map((session) => session.id)).size, 59);

const invalidEmptyPageService = {
  async listSessions(request: AgentSessionPageRequest = {}) {
    return {
      items: [],
      pageInfo: { mode: 'offset', page: request.page, pageSize: 20, hasMore: true },
    };
  },
} as unknown as IAgentSessionService;
await assert.rejects(
  loadProjectAgentSessionPage(invalidEmptyPageService, secondPage.project, 45),
  /empty page with hasMore=true/u,
);

const invalidPageService = {
  async listSessions() {
    return {
      items: [buildSession(41)],
      pageInfo: { mode: 'offset', page: 99, pageSize: 20, hasMore: false },
    };
  },
} as unknown as IAgentSessionService;
await assert.rejects(
  loadProjectAgentSessionPage(invalidPageService, secondPage.project, 45),
  /returned page 99 while page 3 was requested/u,
);

let continuationSignal: AbortSignal | undefined;
const cancellablePageService = {
  async listSessions(
    _request?: AgentSessionPageRequest,
    options?: AgentSessionReadOptions,
  ) {
    continuationSignal = options?.signal;
    return new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), {
        once: true,
      });
    });
  },
} as unknown as IAgentSessionService;
const continuationController = new AbortController();
const cancelledContinuation = loadProjectAgentSessionPage(
  cancellablePageService,
  firstPage.project,
  25,
  continuationController.signal,
);
continuationController.abort(new DOMException('Session continuation cancelled.', 'AbortError'));
await assert.rejects(cancelledContinuation, (error: unknown) => (
  error instanceof Error && error.name === 'AbortError'
));
assert.equal(continuationSignal?.aborted, true, 'continuation cancellation must reach the SDK call');

let activeBindingReads = 0;
let maximumActiveBindingReads = 0;
const concurrentRefreshService = {
  async listSessions(
    request: AgentSessionPageRequest = {},
    options?: AgentSessionReadOptions,
  ) {
    assert.notEqual(options?.signal?.aborted, true);
    const page = request.page ?? 1;
    const start = (page - 1) * 20;
    return {
      items: Array.from({ length: 20 }, (_, index) => buildSession(start + index + 1)),
      pageInfo: { mode: 'offset', page, pageSize: 20, hasMore: page < 3 },
    };
  },
  async listRuntimeBindings(
    sessionId: string,
    _request?: AgentSessionPageRequest,
    options?: AgentSessionReadOptions,
  ) {
    assert.notEqual(options?.signal?.aborted, true);
    activeBindingReads += 1;
    maximumActiveBindingReads = Math.max(maximumActiveBindingReads, activeBindingReads);
    await new Promise((resolve) => setTimeout(resolve, 2));
    activeBindingReads -= 1;
    const sessionIndex = Number(sessionId.split('.').at(-1));
    const providerId = sessionIndex <= 20
      ? 'openai'
      : sessionIndex <= 40
        ? 'anthropic'
        : 'opencode';
    return {
      items: [{
        providerBindingId: `binding.${providerId}`,
        providerId,
        modelId: `model.${providerId}`,
        isCurrent: true,
        status: 'active',
        updatedAt: '2026-07-24T00:00:00.000Z',
      }],
      pageInfo: { mode: 'offset' as const, page: 1, pageSize: 20, hasMore: false },
    };
  },
  async getSessionUserState(sessionId: string) {
    return buildSessionUserState(sessionId);
  },
} as unknown as IAgentSessionService;
const projectService = {
  async getProjectById() {
    return buildProject();
  },
};
const refreshedProject = await refreshProjectSessions({
  agentSessionService: concurrentRefreshService,
  projectId: 'project.pagination',
  projectService,
});
assert.equal(refreshedProject.status, 'refreshed');
assert.equal(refreshedProject.projects?.[0]?.agentSessionPageInfo?.hasMore, false);
assert.equal(refreshedProject.projects?.[0]?.agentSessions.length, 60);
assert.deepEqual(
  new Set(refreshedProject.projects?.[0]?.agentSessions.map((session) => session.providerId)),
  new Set(['openai', 'anthropic', 'opencode']),
  'project refresh must aggregate every page before deriving the multi-provider Session list',
);
assert.equal(maximumActiveBindingReads, 6, 'runtime binding reads must use the bounded pool');

const fullyLoadedProject = await loadCompleteProjectAgentSessionInventory(
  concurrentRefreshService,
  buildProject(),
);
assert.equal(fullyLoadedProject.agentSessions.length, 60);
assert.equal(fullyLoadedProject.agentSessionPageInfo?.page, 3);
assert.equal(fullyLoadedProject.agentSessionPageInfo?.hasMore, false);

let timedOutSignal: AbortSignal | undefined;
const timeoutService = {
  async listSessions(
    _request?: AgentSessionPageRequest,
    options?: AgentSessionReadOptions,
  ) {
    timedOutSignal = options?.signal;
    return new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), {
        once: true,
      });
    });
  },
} as unknown as IAgentSessionService;
await assert.rejects(
  refreshProjectSessions({
    agentSessionService: timeoutService,
    projectId: 'project.pagination',
    projectService,
    refreshTimeoutMs: 5,
  }),
  /timed out after 5 ms/u,
);
assert.equal(timedOutSignal?.aborted, true, 'refresh timeout must abort the SDK request');

let itemRequest: AgentSessionPageRequest | undefined;
let itemReadSignal: AbortSignal | undefined;
const itemRefreshService = {
  async getSession(_sessionId: string, options?: AgentSessionReadOptions) {
    itemReadSignal = options?.signal;
    return buildSession(1);
  },
  async listSessionItems(
    _sessionId: string,
    request?: AgentSessionPageRequest,
    options?: AgentSessionReadOptions,
  ) {
    itemRequest = request;
    assert.equal(options?.signal, itemReadSignal);
    return {
      items: [
        {
          sessionId: 'session.pagination.1',
          itemId: 'item.pagination.2',
          kind: 'assistant_output',
          status: 'completed',
          sequence: '2',
          content: 'second',
          contentType: 'text/plain',
          createdAt: '2026-07-24T00:00:02.000Z',
        },
        {
          sessionId: 'session.pagination.1',
          itemId: 'item.pagination.1',
          kind: 'user_input',
          status: 'completed',
          sequence: '1',
          content: 'first',
          contentType: 'text/plain',
          createdAt: '2026-07-24T00:00:01.000Z',
        },
      ],
      pageInfo: { mode: 'offset', page: 1, pageSize: 20, hasMore: true },
    };
  },
  async listRuntimeBindings() {
    return buildEmptyRuntimeBindingsPage();
  },
  async getSessionUserState(sessionId: string) {
    return buildSessionUserState(sessionId);
  },
} as unknown as IAgentSessionService;
const selectedSession = {
  id: 'session.pagination.1',
  projectId: 'project.pagination',
  items: [],
} as unknown as AgentSessionView;
const refreshedItems = await refreshAgentSessionItems({
  agentSessionService: itemRefreshService,
  agentSessionId: selectedSession.id,
  resolvedLocation: { agentSession: selectedSession, project: buildProject() },
});
assert.deepEqual(itemRequest, { page: 1, pageSize: 20, sort: '-sequence' });
assert.equal(refreshedItems.agentSession?.itemPageInfo?.hasMore, true);
assert.deepEqual(
  refreshedItems.agentSession?.items.map((item) => item.id),
  ['item.pagination.1', 'item.pagination.2'],
  'descending server pages must be normalized into chronological transcript order',
);

const refreshedAgentSession = refreshedItems.agentSession!;
const optimisticItem = {
  id: 'item.pagination.optimistic',
  sessionId: refreshedAgentSession.id,
  role: 'user',
  content: 'optimistic newer message',
  createdAt: '2026-07-24T00:00:03.000Z',
  timestamp: Date.parse('2026-07-24T00:00:03.000Z'),
} as const;
let earlierItemRequest: AgentSessionPageRequest | undefined;
const earlierItemsService = {
  async listSessionItems(
    _sessionId: string,
    request?: AgentSessionPageRequest,
    options?: AgentSessionReadOptions,
  ) {
    earlierItemRequest = request;
    assert.equal(options?.signal?.aborted, false);
    return {
      items: [
        {
          sessionId: refreshedAgentSession.id,
          itemId: 'item.pagination.1',
          kind: 'user_input',
          status: 'completed',
          sequence: '1',
          content: 'first',
          contentType: 'text/plain',
          createdAt: '2026-07-24T00:00:01.000Z',
        },
        {
          sessionId: refreshedAgentSession.id,
          itemId: 'item.pagination.0',
          kind: 'assistant_output',
          status: 'completed',
          sequence: '0',
          content: 'earliest',
          contentType: 'text/plain',
          createdAt: '2026-07-24T00:00:00.000Z',
        },
      ],
      pageInfo: { mode: 'offset', page: 2, pageSize: 20, hasMore: false },
    };
  },
} as unknown as IAgentSessionService;
const loadedEarlierItems = await loadEarlierAgentSessionItems({
  agentSession: {
    ...refreshedAgentSession,
    items: [...refreshedAgentSession.items, optimisticItem],
  },
  agentSessionService: earlierItemsService,
});
assert.deepEqual(earlierItemRequest, { page: 2, pageSize: 20, sort: '-sequence' });
assert.equal(loadedEarlierItems.status, 'loaded');
assert.deepEqual(loadedEarlierItems.agentSession.itemPageInfo, {
  page: 2,
  pageSize: 20,
  hasMore: false,
});
assert.deepEqual(
  loadedEarlierItems.agentSession.items.map((item) => item.id),
  [
    'item.pagination.0',
    'item.pagination.1',
    'item.pagination.2',
    'item.pagination.optimistic',
  ],
  'an older page must prepend chronologically, deduplicate overlap, and preserve optimistic items',
);

const storeUserScope = 'pagination-contract-user';
const storeWorkspaceId = 'workspace.pagination';
const storeScopeKey = buildProjectsStoreScopeKey(storeUserScope, storeWorkspaceId);
const storedProject = {
  ...buildProject(),
  workspaceId: storeWorkspaceId,
  agentSessions: [refreshedAgentSession],
};
upsertProjectIntoProjectsStore(storedProject, storeUserScope);
upsertAgentSessionIntoProjectsStore(
  storedProject.projectId,
  {
    ...refreshedAgentSession,
    itemPageInfo: { page: 2, pageSize: 20, hasMore: true },
  },
  storeWorkspaceId,
  storeUserScope,
);
assert.equal(
  getProjectsStore(storeScopeKey).snapshot.projects[0]?.agentSessions[0]?.itemPageInfo?.page,
  2,
  'pagination metadata must advance even when a continuation page contains only duplicate items',
);
deleteProjectsStore(storeScopeKey);

const emptyEarlierItemsService = {
  async listSessionItems() {
    return {
      items: [],
      pageInfo: { mode: 'offset', page: 2, pageSize: 20, hasMore: true },
    };
  },
} as unknown as IAgentSessionService;
await assert.rejects(
  loadEarlierAgentSessionItems({
    agentSession: refreshedAgentSession,
    agentSessionService: emptyEarlierItemsService,
  }),
  /empty page with hasMore=true/u,
);

const wrongEarlierItemsPageService = {
  async listSessionItems() {
    return {
      items: [],
      pageInfo: { mode: 'offset', page: 3, pageSize: 20, hasMore: false },
    };
  },
} as unknown as IAgentSessionService;
await assert.rejects(
  loadEarlierAgentSessionItems({
    agentSession: refreshedAgentSession,
    agentSessionService: wrongEarlierItemsPageService,
  }),
  /unexpected page/u,
);

let earlierItemSignal: AbortSignal | undefined;
const cancellableEarlierItemsService = {
  async listSessionItems(
    _sessionId: string,
    _request?: AgentSessionPageRequest,
    options?: AgentSessionReadOptions,
  ) {
    earlierItemSignal = options?.signal;
    return new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), {
        once: true,
      });
    });
  },
} as unknown as IAgentSessionService;
const earlierItemsController = new AbortController();
const cancelledEarlierItems = loadEarlierAgentSessionItems({
  agentSession: refreshedAgentSession,
  agentSessionService: cancellableEarlierItemsService,
  signal: earlierItemsController.signal,
});
earlierItemsController.abort(new DOMException('Transcript history cancelled.', 'AbortError'));
await assert.rejects(cancelledEarlierItems, (error: unknown) => (
  error instanceof Error && error.name === 'AbortError'
));
assert.equal(earlierItemSignal?.aborted, true, 'history cancellation must reach the SDK call');

console.log('agent session pagination and refresh contract passed.');
