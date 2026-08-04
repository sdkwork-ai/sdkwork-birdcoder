import assert from 'node:assert/strict';

import type {
  AgentProjectView,
  AgentSessionView,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';
import type {
  AgentSessionActivityPageRequest,
  AgentSessionIdentity,
  AgentSessionItemPageRequest,
  AgentSessionItemSynchronizationRequest,
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

const AGENT_ID = 'agent.birdcoder';

function synchronizeSessionItemsThroughList(
  this: Pick<IAgentSessionService, 'listSessionItems'>,
  identity: AgentSessionIdentity,
  request?: AgentSessionItemSynchronizationRequest,
  options?: AgentSessionReadOptions,
) {
  return this.listSessionItems(identity, request, options);
}

function buildSession(index: number, projectId = 'project.pagination') {
  const timestamp = new Date(Date.UTC(2026, 6, 24, 0, 0, index)).toISOString();
  return {
    agentId: AGENT_ID,
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

function buildSessionUserStates(identities: readonly AgentSessionIdentity[]) {
  return new Map(identities.map(({ sessionId }) => [
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

function buildSelectedSession(sessionId: string): AgentSessionView {
  return {
    agentId: AGENT_ID,
    id: sessionId,
    projectId: 'project.pagination',
    items: [],
  } as unknown as AgentSessionView;
}

function buildActivitySummary(index: number, projectId = 'project.pagination') {
  const session = buildSession(index, projectId);
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

const requestedActivityPages: AgentSessionActivityPageRequest[] = [];
const paginatedService = {
  async listSessionActivitySummaries(request: AgentSessionActivityPageRequest = {}) {
    requestedActivityPages.push(request);
    const isFirstPage = request.cursor === undefined;
    const indexes = isFirstPage
      ? Array.from({ length: 100 }, (_, index) => index + 1)
      : [100, ...Array.from({ length: 99 }, (_, index) => index + 101)];
    return {
      items: indexes.map((index) => buildActivitySummary(index)),
      pageInfo: {
        mode: 'cursor',
        pageSize: 100,
        hasMore: isFirstPage,
        nextCursor: isFirstPage ? 'cursor.project-page-2' : null,
      },
    };
  },
} as unknown as IAgentSessionService;

const firstPage = await loadProjectAgentSessionPage(paginatedService, buildProject(), 5);
assert.equal(firstPage.project.agentSessions.length, 100);
assert.deepEqual(firstPage.project.agentSessionPageInfo, {
  hasMore: true,
  hasNewer: false,
  mode: 'cursor',
  nextCursor: 'cursor.project-page-2',
  pageSize: 100,
});

const missingUserStateService = {
  async listSessionActivitySummaries() {
    const activeSummary = buildActivitySummary(101);
    const archivedSummary = buildActivitySummary(102);
    return {
      items: [
        {
          ...activeSummary,
          session: {
            ...activeSummary.session,
            agentId: 'agent.codex',
            title: 'State-free active session',
          },
        },
        {
          ...archivedSummary,
          session: {
            ...archivedSummary.session,
            agentId: 'agent.codex',
            status: 'archived',
            title: 'State-free archived session',
          },
        },
      ],
      pageInfo: { mode: 'cursor', nextCursor: null, pageSize: 100, hasMore: false },
    };
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
  async listSessionActivitySummaries() {
    return {
      items: [buildActivitySummary(1), buildActivitySummary(3)],
      pageInfo: { mode: 'cursor', nextCursor: null, pageSize: 100, hasMore: false },
    };
  },
} as unknown as IAgentSessionService;
const mergedPageOne = await loadProjectAgentSessionPage(pageOneMergeService, {
  ...buildProject(),
  agentSessions: [pageOneActivitySession, activityHeadOnlySession],
}, 10);
assert.deepEqual(
  new Set(mergedPageOne.project.agentSessions.map((session) => session.id)),
  new Set(['session.pagination.1', 'session.pagination.3', 'session.activity-head-only']),
  'page one cursor hydration must merge with the already loaded activity head',
);
assert.equal(
  mergedPageOne.project.agentSessions.find((session) => session.id === 'session.pagination.1')
    ?.activity,
  pageOneActivitySession.activity,
  'page one cursor hydration must retain the authoritative activity projection',
);
assert.equal(
  mergedPageOne.project.agentSessions.find((session) => session.id === 'session.pagination.1')
    ?.items[0]?.id,
  'item.activity-head',
  'page one cursor hydration must retain an already loaded transcript',
);
assert.equal(
  mergedPageOne.project.agentSessions.find((session) => session.id === 'session.activity-head-only'),
  activityHeadOnlySession,
  'page one cursor hydration must retain Sessions outside its bounded page',
);

const cachedPrefix = await loadProjectAgentSessionPage(
  paginatedService,
  firstPage.project,
  15,
);
assert.equal(cachedPrefix.project, firstPage.project);
assert.equal(requestedActivityPages.length, 1, 'a cached visible prefix must not re-fetch page one');

const secondPage = await loadProjectAgentSessionPage(
  paginatedService,
  firstPage.project,
  125,
);
assert.deepEqual(requestedActivityPages.map((request) => request.cursor), [undefined, 'cursor.project-page-2']);
assert.equal(secondPage.project.agentSessions.length, 199);
assert.equal(secondPage.project.agentSessionPageInfo?.nextCursor, null);
assert.equal(secondPage.hasMore, true);
assert.equal(
  secondPage.project.agentSessions.find((session) => session.id === 'session.pagination.1'),
  firstPage.project.agentSessions[0],
  'appending a server page must preserve existing Session object identity',
);

const boundedWindowService = {
  async listSessionActivitySummaries(request: AgentSessionActivityPageRequest = {}) {
    const pageIndex = request.cursor === undefined
      ? 0
      : request.cursor === 'cursor.window.2'
        ? 1
        : 2;
    const start = pageIndex * 100 + 1;
    return {
      items: Array.from({ length: 100 }, (_, index) => buildActivitySummary(start + index)),
      pageInfo: {
        mode: 'cursor',
        nextCursor: pageIndex < 2 ? `cursor.window.${pageIndex + 2}` : null,
        pageSize: 100,
        hasMore: pageIndex < 2,
      },
    };
  },
} as unknown as IAgentSessionService;
const boundedWindowPageOne = await loadProjectAgentSessionPage(
  boundedWindowService,
  buildProject(),
  1,
);
const boundedWindowPageTwo = await loadProjectAgentSessionPage(
  boundedWindowService,
  boundedWindowPageOne.project,
  101,
);
const boundedWindowPageThree = await loadProjectAgentSessionPage(
  boundedWindowService,
  boundedWindowPageTwo.project,
  201,
);
assert.equal(boundedWindowPageThree.project.agentSessions.length, 300);
assert.equal(boundedWindowPageThree.hasNewer, false);
assert.equal(boundedWindowPageThree.windowShifted, false);
assert.equal(boundedWindowPageThree.project.agentSessionPageInfo?.hasNewer, false);
assert.equal(boundedWindowPageThree.project.agentSessions[0]?.id, 'session.pagination.1');
assert.equal(boundedWindowPageThree.project.agentSessions.at(-1)?.id, 'session.pagination.300');
const resetToLatestWindow = await loadProjectAgentSessionPage(
  boundedWindowService,
  boundedWindowPageThree.project,
  1,
  undefined,
  { resetWindow: true },
);
assert.equal(resetToLatestWindow.project.agentSessions.length, 100);
assert.equal(resetToLatestWindow.hasNewer, false);
assert.equal(resetToLatestWindow.windowShifted, false);
assert.equal(resetToLatestWindow.project.agentSessionPageInfo?.nextCursor, 'cursor.window.2');

const shortPageProject = {
  ...buildProject(),
  agentSessionPageInfo: {
    hasMore: true,
    hasNewer: false,
    mode: 'cursor' as const,
    nextCursor: 'cursor.short-page.2',
    pageSize: 100,
  },
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
    agentSessionPageInfo: {
      hasMore: false,
      hasNewer: false,
      mode: 'cursor',
      nextCursor: null,
      pageSize: 100,
    },
  }, 5),
  false,
);

const duplicatePageService = {
  async listSessionActivitySummaries() {
    return {
      items: [buildActivitySummary(201), buildActivitySummary(201)],
      pageInfo: { mode: 'cursor', nextCursor: null, pageSize: 100, hasMore: false },
    };
  },
} as unknown as IAgentSessionService;
await assert.rejects(
  loadProjectAgentSessionPage(duplicatePageService, buildProject(), 1),
  /duplicate Session identity/u,
);

const invalidEmptyPageService = {
  async listSessionActivitySummaries() {
    return {
      items: [],
      pageInfo: {
        mode: 'cursor',
        nextCursor: 'cursor.invalid-empty.next',
        pageSize: 100,
        hasMore: true,
      },
    };
  },
} as unknown as IAgentSessionService;
await assert.rejects(
  loadProjectAgentSessionPage(invalidEmptyPageService, buildProject(), 1),
  /empty page with hasMore=true/u,
);

const invalidCursorService = {
  async listSessionActivitySummaries() {
    return {
      items: [buildActivitySummary(200)],
      pageInfo: {
        mode: 'cursor',
        nextCursor: 'cursor.project-page-2',
        pageSize: 100,
        hasMore: true,
      },
    };
  },
} as unknown as IAgentSessionService;
await assert.rejects(
  loadProjectAgentSessionPage(invalidCursorService, firstPage.project, 125),
  /non-progressing cursor page/u,
);

const escapedProjectService = {
  async listSessionActivitySummaries() {
    return {
      items: [buildActivitySummary(201, 'project.outside-scope')],
      pageInfo: { mode: 'cursor', nextCursor: null, pageSize: 100, hasMore: false },
    };
  },
} as unknown as IAgentSessionService;
await assert.rejects(
  loadProjectAgentSessionPage(escapedProjectService, buildProject(), 1),
  /escaped its requested Project scope/u,
);

let continuationSignal: AbortSignal | undefined;
const cancellablePageService = {
  async listSessionActivitySummaries(
    _request?: AgentSessionActivityPageRequest,
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
  125,
  continuationController.signal,
);
continuationController.abort(new DOMException('Session continuation cancelled.', 'AbortError'));
await assert.rejects(cancelledContinuation, (error: unknown) => (
  error instanceof Error && error.name === 'AbortError'
));
assert.equal(continuationSignal?.aborted, true, 'continuation cancellation must reach the SDK call');

let activeBindingReads = 0;
let activityHeadReads = 0;
let projectSynchronizationCalls = 0;
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
    assert.equal(
      projectSynchronizationCalls,
      1,
      'project refresh must synchronize Provider inventory before reading the activity snapshot',
    );
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
  async listRuntimeBindings(
    identity: AgentSessionIdentity,
    _request?: AgentSessionPageRequest,
    options?: AgentSessionReadOptions,
  ) {
    assert.notEqual(options?.signal?.aborted, true);
    activeBindingReads += 1;
    await new Promise((resolve) => setTimeout(resolve, 2));
    activeBindingReads -= 1;
    const sessionIndex = Number(identity.sessionId.split('.').at(-1));
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
  async getSessionUserStates(identities: readonly AgentSessionIdentity[]) {
    return buildSessionUserStates(identities);
  },
  async synchronizeProjectSessions(
    projectId: string,
    options?: AgentSessionReadOptions,
  ) {
    assert.equal(projectId, 'project.pagination');
    assert.notEqual(options?.signal?.aborted, true);
    projectSynchronizationCalls += 1;
    return {
      projectId,
      synchronizedSessionCount: '60',
    };
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
assert.equal(
  projectSynchronizationCalls,
  1,
  'project refresh must trigger exactly one Provider inventory synchronization',
);
assert.deepEqual(refreshedProject.providerSynchronization, {
  projectId: 'project.pagination',
  synchronizedSessionCount: '60',
});
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
  async synchronizeProjectSessions(
    projectId: string,
    options?: AgentSessionReadOptions,
  ) {
    assert.notEqual(options?.signal?.aborted, true);
    assert.equal(projectId, 'project.pagination');
    return {
      projectId,
      synchronizedSessionCount: '1',
    };
  },
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

let itemRequest: AgentSessionItemPageRequest | undefined;
let itemReadSignal: AbortSignal | undefined;
const itemRefreshService = {
  async getSession(identity: AgentSessionIdentity, options?: AgentSessionReadOptions) {
    assert.deepEqual(identity, {
      agentId: AGENT_ID,
      sessionId: 'session.pagination.1',
    });
    itemReadSignal = options?.signal;
    return buildSession(1);
  },
  synchronizeSessionItems: synchronizeSessionItemsThroughList,
  async listSessionItems(
    identity: AgentSessionIdentity,
    request?: AgentSessionItemPageRequest,
    options?: AgentSessionReadOptions,
  ) {
    assert.deepEqual(identity, {
      agentId: AGENT_ID,
      sessionId: 'session.pagination.1',
    });
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
      pageInfo: { mode: 'cursor', nextCursor: null, pageSize: 50, hasMore: false },
    };
  },
  async listRuntimeBindings(_identity: AgentSessionIdentity) {
    return buildEmptyRuntimeBindingsPage();
  },
  async getSessionUserStates(identities: readonly AgentSessionIdentity[]) {
    return buildSessionUserStates(identities);
  },
} as unknown as IAgentSessionService;
const selectedSession = buildSelectedSession('session.pagination.1');
const refreshedItems = await refreshAgentSessionItems({
  agentSessionService: itemRefreshService,
  agentSessionId: selectedSession.id,
  resolvedLocation: { agentSession: selectedSession, project: buildProject() },
});
assert.deepEqual(itemRequest, { cursor: undefined, pageSize: 50, sort: '-sequence' });
assert.equal(refreshedItems.agentSession?.itemPageInfo?.hasMore, false);
assert.deepEqual(
  refreshedItems.agentSession?.items.map((item) => item.id),
  ['item.pagination.1', 'item.pagination.2'],
  'descending server pages must be normalized into chronological transcript order',
);

const recoveredItems = await refreshAgentSessionItems({
  agentSessionService: itemRefreshService,
  agentSessionId: selectedSession.id,
  resolvedLocation: { agentSession: selectedSession, project: buildProject() },
});
assert.equal(recoveredItems.status, 'refreshed');
assert.equal(recoveredItems.agentSession?.id, selectedSession.id);
assert.deepEqual(
  recoveredItems.agentSession?.items.map((item) => item.id),
  ['item.pagination.1', 'item.pagination.2'],
  'a recovered Session outside the loaded Project page must hydrate from its known Project location',
);

const recentConversationPageRequests: AgentSessionItemPageRequest[] = [];
const recentConversationService = {
  async getSession(identity: AgentSessionIdentity) {
    assert.deepEqual(identity, {
      agentId: AGENT_ID,
      sessionId: 'session.pagination.200',
    });
    return buildSession(200);
  },
  synchronizeSessionItems: synchronizeSessionItemsThroughList,
  async listSessionItems(
    identity: AgentSessionIdentity,
    request: AgentSessionItemPageRequest = {},
  ) {
    const { sessionId } = identity;
    assert.equal(identity.agentId, AGENT_ID);
    // The synchronization command is forwarded through the same list slot by
    // the fixture, but only cursor list requests are page evidence: the
    // forwarded synchronize request carries only an abort signal.
    if ('pageSize' in request) {
      recentConversationPageRequests.push(request);
    }
    const page = request.cursor === undefined ? 1 : Number(request.cursor.split('.').at(-1)) + 1;
    const newestSequence = 200 - ((page - 1) * 50);
    const items = Array.from({ length: 50 }, (_, index) => {
      const sequence = newestSequence - index;
      const turnOffset = Math.floor(index / 10);
      const turnNumber = ((page - 1) * 4) + turnOffset + 1;
      const isAssistant = index === 7 || index === 17 || index === 27 || index === 37;
      const isUser = index === 8 || index === 18 || index === 28 || index === 38;
      const isHiddenUserInstruction = index < 7 || index === 9;
      return {
        sessionId,
        itemId: `item.recent.${sequence}`,
        kind: isAssistant
          ? 'assistant_output' as const
          : isUser
            ? 'user_input' as const
            : isHiddenUserInstruction
              ? 'user_input' as const
              : 'system_instruction' as const,
        status: 'completed' as const,
        sequence: String(sequence),
        content: isAssistant
          ? `assistant turn ${turnNumber}`
          : isUser
            ? `user turn ${turnNumber}`
            : isHiddenUserInstruction
              ? `# AGENTS.md instructions for /workspace/${sequence}`
              : `internal event ${sequence}`,
        contentType: 'text/plain',
        turnId: isHiddenUserInstruction
          ? `turn.hidden.${sequence}`
          : `turn.recent.${turnNumber}`,
        createdAt: new Date(Date.UTC(2026, 6, 24, 1, 0, sequence)).toISOString(),
      };
    });
    return {
      items,
      pageInfo: {
        mode: 'cursor' as const,
        nextCursor: page < 3 ? `cursor.recent.${page}` : null,
        pageSize: 50,
        hasMore: page < 3,
      },
    };
  },
  async listRuntimeBindings(_identity: AgentSessionIdentity) {
    return buildEmptyRuntimeBindingsPage();
  },
  async getSessionUserStates(identities: readonly AgentSessionIdentity[]) {
    return buildSessionUserStates(identities);
  },
} as unknown as IAgentSessionService;
const recentSelectedSession = buildSelectedSession('session.pagination.200');
const recentConversationWindow = await refreshAgentSessionItems({
  agentSessionService: recentConversationService,
  agentSessionId: recentSelectedSession.id,
  resolvedLocation: { agentSession: recentSelectedSession, project: buildProject() },
});
assert.deepEqual(
  recentConversationPageRequests,
  [undefined, 'cursor.recent.1'].map((cursor) => ({
    cursor,
    pageSize: 50,
    sort: '-sequence' as const,
  })),
  'hidden instruction inputs must not consume the bounded initial conversation-turn target',
);
assert.equal(
  recentConversationWindow.agentSession?.itemPageInfo?.nextCursor,
  'cursor.recent.2',
);
assert.equal(
  recentConversationWindow.agentSession?.items.filter((item) => item.role === 'user').length,
  8,
  'internal Session Items must not leave the first transcript window with only one visible reply',
);
assert.equal(
  recentConversationWindow.agentSession?.items.at(-1)?.id,
  'item.recent.193',
  'multi-page context hydration must still end at the newest visible authority item',
);

recentConversationPageRequests.length = 0;
const provisionalOnlyWindow = {
  ...recentConversationWindow.agentSession!,
  itemPageInfo: undefined,
  items: Array.from({ length: 8 }, (_, index) => ({
    id: '',
    sessionId: 'session.pagination.200',
    turnId: `turn.provisional.${index + 1}`,
    role: 'user' as const,
    content: `provisional user turn ${index + 1}`,
    createdAt: `2026-07-24T00:00:0${index + 1}.000Z`,
  })),
};
await refreshAgentSessionItems({
  agentSessionService: recentConversationService,
  agentSessionId: provisionalOnlyWindow.id,
  resolvedLocation: {
    agentSession: provisionalOnlyWindow,
    project: buildProject(),
  },
});
assert.deepEqual(
  recentConversationPageRequests,
  [undefined, 'cursor.recent.1'].map((cursor) => ({
    cursor,
    pageSize: 50,
    sort: '-sequence' as const,
  })),
  'provisional turns without authority ids must not shorten initial authority hydration',
);

const wrongSortService = {
  async getSession(identity: AgentSessionIdentity) {
    assert.deepEqual(identity, {
      agentId: AGENT_ID,
      sessionId: 'session.pagination.2',
    });
    return buildSession(2);
  },
  synchronizeSessionItems: synchronizeSessionItemsThroughList,
  async listSessionItems(identity: AgentSessionIdentity) {
    const { sessionId } = identity;
    return {
      items: [1, 2].map((sequence) => ({
        sessionId,
        itemId: `item.wrong-sort.${sequence}`,
        kind: sequence === 1 ? 'user_input' as const : 'assistant_output' as const,
        status: 'completed' as const,
        sequence: String(sequence),
        content: `wrong sort ${sequence}`,
        contentType: 'text/plain',
        createdAt: `2026-07-24T02:00:0${sequence}.000Z`,
      })),
      pageInfo: {
        mode: 'cursor' as const,
        nextCursor: null,
        pageSize: 50,
        hasMore: false,
      },
    };
  },
} as unknown as IAgentSessionService;
const wrongSortSelectedSession = buildSelectedSession('session.pagination.2');
await assert.rejects(
  refreshAgentSessionItems({
    agentSessionService: wrongSortService,
    agentSessionId: wrongSortSelectedSession.id,
    resolvedLocation: { agentSession: wrongSortSelectedSession, project: buildProject() },
  }),
  /did not honor the requested descending sequence order/u,
  'an ascending old page must never be committed as the newest transcript window',
);

const emptySequenceService = {
  async getSession(identity: AgentSessionIdentity) {
    assert.deepEqual(identity, {
      agentId: AGENT_ID,
      sessionId: 'session.pagination.1',
    });
    return buildSession(1);
  },
  synchronizeSessionItems: synchronizeSessionItemsThroughList,
  async listSessionItems(identity: AgentSessionIdentity) {
    const { sessionId } = identity;
    return {
      items: [{
        sessionId,
        itemId: 'item.empty-sequence',
        kind: 'assistant_output' as const,
        status: 'completed' as const,
        sequence: '',
        content: 'invalid sequence',
        contentType: 'text/plain',
        createdAt: '2026-07-24T02:00:01.000Z',
      }],
      pageInfo: {
        mode: 'cursor' as const,
        nextCursor: null,
        pageSize: 50,
        hasMore: false,
      },
    };
  },
} as unknown as IAgentSessionService;
await assert.rejects(
  refreshAgentSessionItems({
    agentSessionService: emptySequenceService,
    agentSessionId: selectedSession.id,
    resolvedLocation: { agentSession: selectedSession, project: buildProject() },
  }),
  /invalid Session Item sequence/u,
  'an empty sequence must not be coerced to zero and committed',
);

const missingSelectedSession = buildSelectedSession('session.pagination.missing');
const missingRecoveredItems = await refreshAgentSessionItems({
  agentSessionService: {
    async getSession(identity: AgentSessionIdentity) {
      assert.deepEqual(identity, {
        agentId: AGENT_ID,
        sessionId: missingSelectedSession.id,
      });
      throw Object.assign(new Error('Agent Session not found.'), { status: 404 });
    },
  } as unknown as IAgentSessionService,
  agentSessionId: missingSelectedSession.id,
  resolvedLocation: { agentSession: missingSelectedSession, project: buildProject() },
});
assert.equal(missingRecoveredItems.status, 'not-found');
assert.equal(missingRecoveredItems.projectId, 'project.pagination');

await assert.rejects(
  refreshAgentSessionItems({
    agentSessionService: {
      async getSession(identity: AgentSessionIdentity) {
        assert.deepEqual(identity, {
          agentId: AGENT_ID,
          sessionId: selectedSession.id,
        });
        return buildSession(1);
      },
      synchronizeSessionItems: synchronizeSessionItemsThroughList,
      async listSessionItems(identity: AgentSessionIdentity) {
        assert.deepEqual(identity, {
          agentId: AGENT_ID,
          sessionId: selectedSession.id,
        });
        throw Object.assign(new Error('Canonical Session items are not visible.'), {
          httpStatus: 404,
        });
      },
    } as unknown as IAgentSessionService,
    agentSessionId: selectedSession.id,
    resolvedLocation: { agentSession: selectedSession, project: buildProject() },
  }),
  /Canonical Session items are not visible/u,
  'a nested /items 404 must not evict a Session already proven by getSession',
);

const refreshedAgentSession = {
  ...refreshedItems.agentSession!,
  itemPageInfo: { hasMore: true, nextCursor: 'cursor.loaded.1', pageSize: 50 },
};

const staleHeadSession = {
  ...refreshedAgentSession,
  itemPageInfo: { hasMore: true, nextCursor: 'cursor.loaded.2', pageSize: 50 },
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
const headReconciliationRequests: Array<string | undefined> = [];
const headReconciliationService = {
  async getSession(identity: AgentSessionIdentity) {
    assert.deepEqual(identity, {
      agentId: staleHeadSession.agentId,
      sessionId: staleHeadSession.id,
    });
    return {
      sessionId: staleHeadSession.id,
      agentId: AGENT_ID,
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
  synchronizeSessionItems: synchronizeSessionItemsThroughList,
  async listSessionItems(
    identity: AgentSessionIdentity,
    request?: AgentSessionItemPageRequest,
  ) {
    const { sessionId } = identity;
    assert.equal(identity.agentId, staleHeadSession.agentId);
    const page = request?.cursor === undefined ? 1 : 2;
    // The forwarded synchronization command carries only an abort signal and
    // is not cursor page evidence for the head-reconciliation walk.
    if (request && 'pageSize' in request) {
      headReconciliationRequests.push(request.cursor);
    }
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
        mode: 'cursor' as const,
        nextCursor: page === 1 ? 'cursor.head.1' : null,
        pageSize: 50,
        hasMore: page === 1,
      },
    };
  },
  async listRuntimeBindings(_identity: AgentSessionIdentity) {
    return buildEmptyRuntimeBindingsPage();
  },
  async getSessionUserStates(identities: readonly AgentSessionIdentity[]) {
    return buildSessionUserStates(identities);
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
assert.deepEqual(headReconciliationRequests, [undefined, 'cursor.head.1']);
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
      itemPageInfo: { hasMore: false, nextCursor: null, pageSize: 50 },
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
const boundedHeadRequests: Array<string | undefined> = [];
const boundedHeadService = {
  async getSession(identity: AgentSessionIdentity) {
    assert.deepEqual(identity, {
      agentId: boundedHeadSession.agentId,
      sessionId: boundedHeadSession.id,
    });
    return {
      sessionId: boundedHeadSession.id,
      agentId: AGENT_ID,
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
  synchronizeSessionItems: synchronizeSessionItemsThroughList,
  async listSessionItems(
    identity: AgentSessionIdentity,
    request?: AgentSessionItemPageRequest,
  ) {
    const { sessionId } = identity;
    assert.equal(identity.agentId, boundedHeadSession.agentId);
    const page = request?.cursor === undefined
      ? 1
      : Number(request.cursor.split('.').at(-1)) + 1;
    // The forwarded synchronization command carries only an abort signal and
    // is not cursor page evidence for the bounded head walk.
    if (request && 'pageSize' in request) {
      boundedHeadRequests.push(request.cursor);
    }
    const sequences = Array.from(
      { length: 20 },
      (_, index) => 200 - ((page - 1) * 20) - index,
    );
    return {
      items: sequences.map((sequence, index) => ({
        sessionId,
        itemId: page === 7 && index === 0
          ? 'item.head.2'
          : `item.bounded-head.${sequence}`,
        kind: sequence % 2 === 0 ? 'assistant_output' : 'user_input',
        status: 'completed',
        sequence: String(sequence),
        content: `bounded head ${sequence}`,
        contentType: 'text/plain',
        createdAt: new Date(Date.UTC(2026, 6, 24, 0, 0, sequence)).toISOString(),
      })),
      pageInfo: {
        mode: 'cursor' as const,
        nextCursor: page < 7 ? `cursor.bounded.${page}` : null,
        pageSize: 50,
        hasMore: page < 7,
      },
    };
  },
  async listRuntimeBindings(_identity: AgentSessionIdentity) {
    return buildEmptyRuntimeBindingsPage();
  },
  async getSessionUserStates(identities: readonly AgentSessionIdentity[]) {
    return buildSessionUserStates(identities);
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
  [
    undefined,
    'cursor.bounded.1',
    'cursor.bounded.2',
    'cursor.bounded.3',
    'cursor.bounded.4',
    'cursor.bounded.5',
    'cursor.bounded.6',
  ],
  'head reconciliation must use bounded cursor pages until it reaches the loaded window',
);
assert.equal(
  resetBoundedHead.agentSession?.itemPageInfo?.nextCursor,
  staleHeadSession.itemPageInfo.nextCursor,
);
assert.equal(resetBoundedHead.replaceLoadedAuthorityWindow, false);
assert.equal(
  resetBoundedHead.agentSession?.items.some((item) => item.id === 'item.head.1'),
  true,
  'a stale authority tail must remain joined after deep head reconciliation finds overlap',
);
assert.equal(
  resetBoundedHead.agentSession?.items.some((item) => item.id === resetOptimisticItem.id),
  true,
  'deep head reconciliation must retain optimistic work while joining the authority window',
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

let earlierItemRequest: AgentSessionItemPageRequest | undefined;
const earlierItemsService = {
  async listSessionItems(
    identity: AgentSessionIdentity,
    request?: AgentSessionItemPageRequest,
    options?: AgentSessionReadOptions,
  ) {
    assert.deepEqual(identity, {
      agentId: refreshedAgentSession.agentId,
      sessionId: refreshedAgentSession.id,
    });
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
          itemId: 'item.pagination.0',
          kind: 'assistant_output',
          status: 'completed',
          sequence: '0',
          content: 'earliest',
          contentType: 'text/plain',
          createdAt: '2026-07-24T00:00:00.000Z',
        },
      ],
      pageInfo: { mode: 'cursor', nextCursor: null, pageSize: 50, hasMore: false },
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
assert.deepEqual(earlierItemRequest, {
  cursor: refreshedAgentSession.itemPageInfo.nextCursor,
  pageSize: 50,
  sort: '-sequence',
});
assert.equal(loadedEarlierItems.status, 'loaded');
assert.deepEqual(loadedEarlierItems.agentSession.itemPageInfo, {
  nextCursor: null,
  pageSize: 50,
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

const duplicateHistoryRequests: string[] = [];
const duplicateHistoryService = {
  async listSessionItems(
    identity: AgentSessionIdentity,
    request?: AgentSessionItemPageRequest,
  ) {
    const { sessionId } = identity;
    assert.equal(identity.agentId, refreshedAgentSession.agentId);
    const cursor = request?.cursor ?? '';
    duplicateHistoryRequests.push(cursor);
    const page = cursor === 'cursor.history.2' ? 3 : 4;
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
        mode: 'cursor' as const,
        nextCursor: page === 3 ? 'cursor.history.3' : null,
        pageSize: 50,
        hasMore: page === 3,
      },
    };
  },
} as unknown as IAgentSessionService;
const duplicateHistoryResult = await loadEarlierAgentSessionItems({
  agentSession: {
    ...loadedEarlierItems.agentSession,
    itemPageInfo: { hasMore: true, nextCursor: 'cursor.history.2', pageSize: 50 },
  },
  agentSessionService: duplicateHistoryService,
});
assert.deepEqual(
  duplicateHistoryRequests,
  ['cursor.history.2', 'cursor.history.3'],
  'history loading must skip duplicate-only pages while advancing its cursor',
);
assert.equal(duplicateHistoryResult.loadedItemCount, 1);
assert.equal(duplicateHistoryResult.agentSession.itemPageInfo?.nextCursor, null);
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
    itemPageInfo: { nextCursor: 'cursor.incoming.2', pageSize: 50, hasMore: true },
  },
  storeWorkspaceId,
  storeUserScope,
);
assert.equal(
  getProjectsStore(storeScopeKey).snapshot.projects[0]
    ?.agentSessions[0]?.itemPageInfo?.nextCursor,
  refreshedAgentSession.itemPageInfo.nextCursor,
  'ordinary Store merges must preserve the established transcript cursor',
);
deleteProjectsStore(storeScopeKey);

const emptyEarlierItemsService = {
  async listSessionItems(_identity: AgentSessionIdentity) {
    return {
      items: [],
      pageInfo: {
        mode: 'cursor',
        nextCursor: 'cursor.empty.next',
        pageSize: 50,
        hasMore: true,
      },
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

const nonProgressingEarlierItemsCursorService = {
  async listSessionItems(_identity: AgentSessionIdentity) {
    return {
      items: [{
        sessionId: refreshedAgentSession.id,
        itemId: 'item.pagination.cursor-cycle',
        kind: 'assistant_output' as const,
        status: 'completed' as const,
        sequence: '0',
        content: 'cursor cycle',
        contentType: 'text/plain',
        createdAt: '2026-07-24T00:00:00.000Z',
      }],
      pageInfo: {
        mode: 'cursor',
        nextCursor: refreshedAgentSession.itemPageInfo.nextCursor,
        pageSize: 50,
        hasMore: true,
      },
    };
  },
} as unknown as IAgentSessionService;
await assert.rejects(
  loadEarlierAgentSessionItems({
    agentSession: refreshedAgentSession,
    agentSessionService: nonProgressingEarlierItemsCursorService,
  }),
  /non-progressing cursor page/u,
);

let earlierItemSignal: AbortSignal | undefined;
const cancellableEarlierItemsService = {
  async listSessionItems(
    identity: AgentSessionIdentity,
    _request?: AgentSessionItemPageRequest,
    options?: AgentSessionReadOptions,
  ) {
    assert.deepEqual(identity, {
      agentId: refreshedAgentSession.agentId,
      sessionId: refreshedAgentSession.id,
    });
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
    pageSize: 50,
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
