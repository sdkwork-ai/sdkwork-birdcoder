import assert from 'node:assert/strict';

import type {
  AgentProjectView,
  AgentSessionView,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';
import type {
  AgentSessionActivityPageRequest,
  AgentSessionPageRequest,
  AgentSessionReadOptions,
  IAgentSessionService,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IAgentSessionService.ts';
import { canLoadMoreProjectSessions } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/ProjectExplorer.shared.ts';
import {
  loadProjectAgentSessionPage,
  normalizeProjectAgentSessionTargetCount,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/agentSessionViewModels.ts';
import {
  buildProjectsStoreScopeKey,
  deleteProjectsStore,
  getProjectsStore,
  updateAgentSessionInCollection,
  upsertAgentSessionIntoCollection,
  upsertAgentSessionIntoProjectsStore,
  upsertProjectIntoCollection,
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

function buildSessionUserStates(sessionIds: readonly string[]) {
  return new Map(sessionIds.map((sessionId) => [
    sessionId,
    buildSessionUserState(sessionId),
  ]));
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

function buildActivitySummary(index: number) {
  const session = buildSession(index);
  return {
    session: {
      ...session,
      id: `id.${session.sessionId}`,
      tenantId: '1001',
      organizationId: '2001',
      agentId: `agent.${session.sessionId}`,
      ownerUserId: '3001',
      entrySurface: 'pc',
      itemCount: String(index),
      totalInputTokens: '0',
      totalOutputTokens: '0',
      createdBy: '3001',
      updatedBy: '3001',
      version: String(index),
    },
    latestTurn: null,
    pendingInteraction: null,
    currentRuntimeBinding: null,
    latestRuntimeBinding: null,
    userState: null,
    providerIdentity: {
      runtimeBindingId: null,
      providerBindingId: null,
      providerId: null,
      modelId: null,
      providerSessionId: null,
      providerSessionTreeId: null,
      providerParentSessionId: null,
      providerForkedFromSessionId: null,
    },
    freshness: {
      activityAt: session.lastItemAt,
      source: 'session',
      observedAt: null,
      freshUntil: null,
      sessionVersion: String(index),
      latestTurnVersion: null,
      latestInteractionId: null,
      latestInteractionVersion: null,
      latestRuntimeBindingId: null,
      latestRuntimeBindingVersion: null,
      pendingInteractionVersion: null,
      currentRuntimeBindingVersion: null,
      userStateVersion: null,
    },
    providerActivity: null,
    presentationPhase: 'idle',
  };
}

const requestedSessionPages: AgentSessionPageRequest[] = [];
const paginatedService = {
  async listSessionsByProject(request: AgentSessionPageRequest = {}) {
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
  async getSessionUserStates(sessionIds: readonly string[]) {
    return buildSessionUserStates(sessionIds);
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
  async listSessionsByProject() {
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
  async getSessionUserStates() {
    return new Map();
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

const pageOneActivitySession: AgentSessionView = {
  ...firstPage.project.agentSessions[0]!,
  activity: {
    activityAt: '2026-07-24T01:00:00.000Z',
    source: 'turn',
    freshness: 'fresh',
    phase: 'running',
    versions: { session: '2', latestTurn: '1' },
  },
  providerId: 'provider.openai',
  runtimeStatus: 'streaming',
  sortTimestamp: String(Date.parse('2026-07-24T01:00:00.000Z')),
  items: [{
    id: 'item.activity-head',
    sessionId: 'session.pagination.1',
    role: 'assistant',
    content: 'Live activity transcript',
    createdAt: '2026-07-24T01:00:00.000Z',
  }],
};
const activityHeadOnlySession: AgentSessionView = {
  ...pageOneActivitySession,
  id: 'session.activity-head-only',
  title: 'Activity head only',
};
const pageOneMergeService = {
  async listSessionsByProject() {
    return {
      items: [buildSession(1), buildSession(3)],
      pageInfo: { mode: 'offset', page: 1, pageSize: 20, hasMore: false },
    };
  },
  async listRuntimeBindings() {
    return buildEmptyRuntimeBindingsPage();
  },
  async getSessionUserStates(sessionIds: readonly string[]) {
    return buildSessionUserStates(sessionIds);
  },
} as unknown as IAgentSessionService;
const mergedPageOne = await loadProjectAgentSessionPage(pageOneMergeService, {
  ...buildProject(),
  agentSessions: [pageOneActivitySession, activityHeadOnlySession],
}, 10);
assert.deepEqual(
  new Set(mergedPageOne.project.agentSessions.map((session) => session.id)),
  new Set(['session.pagination.1', 'session.pagination.3', 'session.activity-head-only']),
  'page one offset hydration must merge with the already loaded activity head',
);
assert.equal(
  mergedPageOne.project.agentSessions.find((session) => session.id === 'session.pagination.1')
    ?.activity,
  pageOneActivitySession.activity,
  'page one offset hydration must retain the authoritative activity projection',
);
assert.equal(
  mergedPageOne.project.agentSessions.find((session) => session.id === 'session.pagination.1')
    ?.items[0]?.id,
  'item.activity-head',
  'page one offset hydration must retain an already loaded transcript',
);
assert.equal(
  mergedPageOne.project.agentSessions.find((session) => session.id === 'session.activity-head-only'),
  activityHeadOnlySession,
  'page one offset hydration must retain Sessions outside its bounded page',
);

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
  async listSessionsByProject(request: AgentSessionPageRequest = {}) {
    return {
      items: [buildSession(20), ...Array.from({ length: 19 }, (_, index) => buildSession(41 + index))],
      pageInfo: { mode: 'offset', page: request.page, pageSize: 20, hasMore: false },
    };
  },
  async listRuntimeBindings() {
    return buildEmptyRuntimeBindingsPage();
  },
  async getSessionUserStates(sessionIds: readonly string[]) {
    return buildSessionUserStates(sessionIds);
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
  async listSessionsByProject(request: AgentSessionPageRequest = {}) {
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
  async listSessionsByProject() {
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
  async listSessionsByProject(
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
let activityHeadReads = 0;
let inventoryReads = 0;
const concurrentRefreshService = {
  async listSessionActivitySummaries(
    request: AgentSessionActivityPageRequest = {},
    options?: AgentSessionReadOptions,
  ) {
    assert.notEqual(options?.signal?.aborted, true);
    assert.deepEqual(request, {
      pageSize: 200,
      projectId: 'project.pagination',
    });
    activityHeadReads += 1;
    return {
      items: Array.from({ length: 60 }, (_, index) => buildActivitySummary(index + 1)),
      pageInfo: {
        mode: 'cursor' as const,
        pageSize: 200,
        hasMore: false,
        nextCursor: null,
      },
    };
  },
  async listSessionsByProject(
    request: AgentSessionPageRequest = {},
    options?: AgentSessionReadOptions,
  ) {
    assert.notEqual(options?.signal?.aborted, true);
    inventoryReads += 1;
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
  async getSessionUserStates(sessionIds: readonly string[]) {
    return buildSessionUserStates(sessionIds);
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
assert.equal(refreshedProject.projects?.[0]?.agentSessions.length, 60);
assert.equal(activityHeadReads, 1, 'project refresh must read one bounded activity head page');
assert.equal(inventoryReads, 0, 'project refresh must not download the legacy offset inventory');
assert.equal(activeBindingReads, 0, 'project refresh must not issue RuntimeBinding N+1 reads');
assert.equal(normalizeProjectAgentSessionTargetCount(Number.NaN), 1);
assert.equal(normalizeProjectAgentSessionTargetCount(0), 1);
assert.equal(normalizeProjectAgentSessionTargetCount(20.9), 20);
assert.equal(
  normalizeProjectAgentSessionTargetCount(Number.MAX_SAFE_INTEGER + 1_000),
  Number.MAX_SAFE_INTEGER,
);

let timedOutSignal: AbortSignal | undefined;
const timeoutService = {
  async listSessionActivitySummaries(
    _request?: AgentSessionActivityPageRequest,
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
          itemId: 'item.pagination.internal-instruction',
          kind: 'system_instruction',
          status: 'completed',
          sequence: '3',
          content: 'Internal execution guidance',
          contentType: 'text/plain',
          createdAt: '2026-07-24T00:00:03.000Z',
        },
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
  async getSessionUserStates(sessionIds: readonly string[]) {
    return buildSessionUserStates(sessionIds);
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

const recoveredItems = await refreshAgentSessionItems({
  agentSessionService: itemRefreshService,
  agentSessionId: selectedSession.id,
  resolvedLocation: { project: buildProject() },
});
assert.equal(recoveredItems.status, 'refreshed');
assert.equal(recoveredItems.agentSession?.id, selectedSession.id);
assert.deepEqual(
  recoveredItems.agentSession?.items.map((item) => item.id),
  ['item.pagination.1', 'item.pagination.2'],
  'a recovered Session outside the loaded Project page must hydrate from its known Project location',
);

const missingRecoveredItems = await refreshAgentSessionItems({
  agentSessionService: {
    async getSession() {
      throw Object.assign(new Error('Agent Session not found.'), { status: 404 });
    },
  } as unknown as IAgentSessionService,
  agentSessionId: 'session.pagination.missing',
  resolvedLocation: { project: buildProject() },
});
assert.equal(missingRecoveredItems.status, 'not-found');
assert.equal(missingRecoveredItems.projectId, 'project.pagination');

const refreshedAgentSession = refreshedItems.agentSession!;

const staleHeadSession = {
  ...refreshedAgentSession,
  itemPageInfo: { hasMore: true, page: 2, pageSize: 20 },
  items: [
    {
      ...refreshedAgentSession.items[0]!,
      id: 'item.head.1',
      metadata: { agentItemSequence: '1' },
    },
    {
      ...refreshedAgentSession.items[1]!,
      id: 'item.head.2',
      metadata: { agentItemSequence: '2' },
    },
  ],
};
const headReconciliationRequests: number[] = [];
const headReconciliationService = {
  async getSession() {
    return {
      sessionId: staleHeadSession.id,
      agentId: 'agent.birdcoder',
      projectId: staleHeadSession.projectId,
      status: 'active',
      title: staleHeadSession.title,
      version: '8',
      lastItemSequence: '8',
      lastItemAt: '2026-07-24T00:00:08.000Z',
      createdAt: staleHeadSession.createdAt,
      updatedAt: '2026-07-24T00:00:08.000Z',
    };
  },
  async listSessionItems(
    sessionId: string,
    request?: AgentSessionPageRequest,
  ) {
    const page = request?.page ?? 1;
    headReconciliationRequests.push(page);
    const pageItems = page === 1
      ? [8, 7, 6]
      : page === 2
        ? [5, 4, 2]
        : [];
    return {
      items: pageItems.map((sequence) => ({
        sessionId,
        itemId: `item.head.${sequence}`,
        kind: sequence % 2 === 0 ? 'assistant_output' : 'user_input',
        status: 'completed',
        sequence: String(sequence),
        content: `head ${sequence}`,
        contentType: 'text/plain',
        createdAt: `2026-07-24T00:00:0${sequence}.000Z`,
      })),
      pageInfo: {
        mode: 'offset' as const,
        page,
        pageSize: 20,
        hasMore: page === 1,
      },
    };
  },
  async listRuntimeBindings() {
    return buildEmptyRuntimeBindingsPage();
  },
  async getSessionUserStates(sessionIds: readonly string[]) {
    return buildSessionUserStates(sessionIds);
  },
} as unknown as IAgentSessionService;
const reconciledHead = await refreshAgentSessionItems({
  agentSessionService: headReconciliationService,
  agentSessionId: staleHeadSession.id,
  resolvedLocation: {
    agentSession: staleHeadSession,
    project: buildProject(),
  },
});
assert.deepEqual(headReconciliationRequests, [1, 2]);
assert.deepEqual(
  reconciledHead.agentSession?.items.map((item) => item.id),
  [
    'item.head.1',
    'item.head.2',
    'item.head.4',
    'item.head.5',
    'item.head.6',
    'item.head.7',
    'item.head.8',
  ],
  'latest-page refresh must bridge every page until it overlaps the loaded transcript window',
);
assert.equal(
  reconciledHead.agentSession?.itemPageInfo?.hasMore,
  true,
  'new head pages must reopen history pagination when offset drift creates deeper pages',
);

const unchangedFullyLoadedHead = await refreshAgentSessionItems({
  agentSessionService: headReconciliationService,
  agentSessionId: staleHeadSession.id,
  resolvedLocation: {
    agentSession: {
      ...reconciledHead.agentSession!,
      itemPageInfo: { hasMore: false, page: 2, pageSize: 20 },
    },
    project: buildProject(),
  },
});
assert.equal(
  unchangedFullyLoadedHead.agentSession?.itemPageInfo?.hasMore,
  false,
  'an unchanged head must not reopen history after the terminal page was already loaded',
);

const optimisticItem = {
  id: 'item.pagination.optimistic',
  sessionId: refreshedAgentSession.id,
  role: 'user',
  content: 'optimistic newer message',
  createdAt: '2026-07-24T00:00:03.000Z',
  timestamp: Date.parse('2026-07-24T00:00:03.000Z'),
} as const;

const resetOptimisticItem = {
  ...optimisticItem,
  id: 'item.head.optimistic',
  metadata: { transient: true },
} as const;
const boundedHeadSession = {
  ...staleHeadSession,
  items: [...staleHeadSession.items, resetOptimisticItem],
} as unknown as AgentSessionView;
const boundedHeadRequests: number[] = [];
const boundedHeadService = {
  async getSession() {
    return {
      sessionId: boundedHeadSession.id,
      agentId: 'agent.birdcoder',
      projectId: boundedHeadSession.projectId,
      status: 'active',
      title: boundedHeadSession.title,
      version: '200',
      lastItemSequence: '200',
      lastItemAt: '2026-07-24T00:03:20.000Z',
      createdAt: boundedHeadSession.createdAt,
      updatedAt: '2026-07-24T00:03:20.000Z',
    };
  },
  async listSessionItems(
    sessionId: string,
    request?: AgentSessionPageRequest,
  ) {
    const page = request?.page ?? 1;
    boundedHeadRequests.push(page);
    const sequences = Array.from(
      { length: 20 },
      (_, index) => 200 - ((page - 1) * 20) - index,
    );
    return {
      items: sequences.map((sequence) => ({
        sessionId,
        itemId: `item.bounded-head.${sequence}`,
        kind: sequence % 2 === 0 ? 'assistant_output' : 'user_input',
        status: 'completed',
        sequence: String(sequence),
        content: `bounded head ${sequence}`,
        contentType: 'text/plain',
        createdAt: new Date(Date.UTC(2026, 6, 24, 0, 0, sequence)).toISOString(),
      })),
      pageInfo: {
        mode: 'offset' as const,
        page,
        pageSize: 20,
        hasMore: true,
      },
    };
  },
  async listRuntimeBindings() {
    return buildEmptyRuntimeBindingsPage();
  },
  async getSessionUserStates(sessionIds: readonly string[]) {
    return buildSessionUserStates(sessionIds);
  },
} as unknown as IAgentSessionService;
const resetBoundedHead = await refreshAgentSessionItems({
  agentSessionService: boundedHeadService,
  agentSessionId: boundedHeadSession.id,
  resolvedLocation: {
    agentSession: boundedHeadSession,
    project: buildProject(),
  },
});
assert.deepEqual(
  boundedHeadRequests,
  [1, 2, 3, 4, 5],
  'head reconciliation must remain bounded when the loaded window is too stale to overlap',
);
assert.equal(resetBoundedHead.agentSession?.itemPageInfo?.page, 5);
assert.equal(resetBoundedHead.replaceLoadedAuthorityWindow, true);
assert.equal(resetBoundedHead.agentSession?.items.length, 101);
assert.equal(
  resetBoundedHead.agentSession?.items.some((item) => item.id === 'item.head.1'),
  false,
  'a stale authority tail must not be joined to a disconnected head window',
);
assert.equal(resetBoundedHead.agentSession?.items[0]?.id, 'item.bounded-head.101');
assert.equal(
  resetBoundedHead.agentSession?.items.at(-1)?.id,
  resetOptimisticItem.id,
  'a disconnected-window reset must retain optimistic work at the newest edge',
);

const transientOnlySession = {
  ...refreshedAgentSession,
  itemPageInfo: undefined,
  items: [resetOptimisticItem],
};
const hydratedTransientOnlySession = await refreshAgentSessionItems({
  agentSessionService: itemRefreshService,
  agentSessionId: transientOnlySession.id,
  resolvedLocation: {
    agentSession: transientOnlySession,
    project: buildProject(),
  },
});
assert.deepEqual(
  hydratedTransientOnlySession.agentSession?.items.map((item) => item.id),
  ['item.pagination.1', 'item.pagination.2', resetOptimisticItem.id],
  'initial authority hydration must keep a transient-only local tail at the newest edge',
);

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
          itemId: 'item.pagination.internal-history',
          kind: 'system_instruction',
          status: 'completed',
          sequence: '0',
          content: 'Historical internal execution guidance',
          contentType: 'text/plain',
          createdAt: '2026-07-23T23:59:59.000Z',
        },
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

const duplicateHistoryRequests: number[] = [];
const duplicateHistoryService = {
  async listSessionItems(
    sessionId: string,
    request?: AgentSessionPageRequest,
  ) {
    const page = request?.page ?? 1;
    duplicateHistoryRequests.push(page);
    const pageItems = page === 3 ? [2, 1] : page === 4 ? [0] : [];
    return {
      items: pageItems.map((sequence) => ({
        sessionId,
        itemId: page === 4
          ? 'item.pagination.offset-older'
          : `item.pagination.${sequence}`,
        kind: sequence % 2 === 0 ? 'assistant_output' : 'user_input',
        status: 'completed',
        sequence: String(sequence),
        content: `history ${sequence}`,
        contentType: 'text/plain',
        createdAt: `2026-07-23T23:59:5${sequence}.000Z`,
      })),
      pageInfo: {
        mode: 'offset' as const,
        page,
        pageSize: 20,
        hasMore: page === 3,
      },
    };
  },
} as unknown as IAgentSessionService;
const duplicateHistoryResult = await loadEarlierAgentSessionItems({
  agentSession: {
    ...loadedEarlierItems.agentSession,
    itemPageInfo: { hasMore: true, page: 2, pageSize: 20 },
  },
  agentSessionService: duplicateHistoryService,
});
assert.deepEqual(
  duplicateHistoryRequests,
  [3, 4],
  'history loading must skip pages containing only overlap after offset drift',
);
assert.equal(duplicateHistoryResult.loadedItemCount, 1);
assert.equal(duplicateHistoryResult.agentSession.itemPageInfo?.page, 4);
assert.equal(
  duplicateHistoryResult.agentSession.items[0]?.id,
  'item.pagination.offset-older',
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

const newerProject = {
  ...buildProject(),
  projectId: 'project.order.newer',
  name: 'Newer project',
  createdAt: '2026-07-26T00:00:00.000Z',
  updatedAt: '2026-07-26T00:00:00.000Z',
};
const olderProject = {
  ...buildProject(),
  projectId: 'project.order.older',
  name: 'Older project',
  createdAt: '2026-07-25T00:00:00.000Z',
  updatedAt: '2026-07-25T00:00:00.000Z',
};
const hydratedOlderProject = {
  ...olderProject,
  agentSessionPageInfo: {
    hasMore: false,
    page: 1,
    pageSize: 20,
  },
  agentSessions: [{
    ...firstPage.project.agentSessions[0]!,
    id: 'session.order.newest',
    projectId: olderProject.projectId,
    createdAt: '2026-07-27T00:00:00.000Z',
    updatedAt: '2026-07-27T00:00:00.000Z',
  }],
};
const projectsAfterSessionHydration = upsertProjectIntoCollection(
  [newerProject, olderProject],
  hydratedOlderProject,
);
assert.deepEqual(
  projectsAfterSessionHydration.map((project) => project.projectId),
  [newerProject.projectId, olderProject.projectId],
  'expanding a Project and hydrating its Sessions must not move it to the front',
);
const projectsAfterSelectedSessionHydration = upsertAgentSessionIntoCollection(
  projectsAfterSessionHydration,
  olderProject.projectId,
  hydratedOlderProject.agentSessions[0]!,
);
assert.deepEqual(
  projectsAfterSelectedSessionHydration.map((project) => project.projectId),
  [newerProject.projectId, olderProject.projectId],
  'selecting a loaded Session while collapsing a Project must not move the Project to the front',
);
assert.equal(
  projectsAfterSelectedSessionHydration[1]?.updatedAt,
  olderProject.updatedAt,
  'hydrating a child Session must preserve the authoritative Project timestamp',
);
const projectsAfterSessionUpdate = updateAgentSessionInCollection(
  projectsAfterSelectedSessionHydration,
  olderProject.projectId,
  hydratedOlderProject.agentSessions[0]!.id,
  (agentSession) => ({
    ...agentSession,
    updatedAt: '2026-07-28T00:00:00.000Z',
  }),
);
assert.deepEqual(
  projectsAfterSessionUpdate.map((project) => project.projectId),
  [newerProject.projectId, olderProject.projectId],
  'updating a child Session must not mutate Project ordering metadata',
);

console.log('agent session pagination and refresh contract passed.');
