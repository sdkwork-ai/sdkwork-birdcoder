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
import {
  loadProjectAgentSessionPage,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/agentSessionViewModels.ts';
import {
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
} as unknown as IAgentSessionService;

const firstPage = await loadProjectAgentSessionPage(paginatedService, buildProject(), 5);
assert.equal(firstPage.project.agentSessions.length, 20);
assert.deepEqual(firstPage.project.agentSessionPageInfo, {
  page: 1,
  pageSize: 20,
  hasMore: true,
});

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

const duplicatePageService = {
  async listSessions(request: AgentSessionPageRequest = {}) {
    return {
      items: [buildSession(20), ...Array.from({ length: 19 }, (_, index) => buildSession(41 + index))],
      pageInfo: { mode: 'offset', page: request.page, pageSize: 20, hasMore: false },
    };
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

let activeBindingReads = 0;
let maximumActiveBindingReads = 0;
const concurrentRefreshService = {
  async listSessions(
    _request?: AgentSessionPageRequest,
    options?: AgentSessionReadOptions,
  ) {
    assert.equal(options?.signal?.aborted, false);
    return {
      items: Array.from({ length: 20 }, (_, index) => buildSession(index + 1)),
      pageInfo: { mode: 'offset', page: 1, pageSize: 20, hasMore: true },
    };
  },
  async listRuntimeBindings(
    _sessionId: string,
    _request?: AgentSessionPageRequest,
    options?: AgentSessionReadOptions,
  ) {
    assert.equal(options?.signal?.aborted, false);
    activeBindingReads += 1;
    maximumActiveBindingReads = Math.max(maximumActiveBindingReads, activeBindingReads);
    await new Promise((resolve) => setTimeout(resolve, 2));
    activeBindingReads -= 1;
    return {
      items: [],
      pageInfo: { mode: 'offset', page: 1, pageSize: 20, hasMore: false },
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
assert.equal(refreshedProject.projects?.[0]?.agentSessionPageInfo?.hasMore, true);
assert.equal(maximumActiveBindingReads, 8, 'runtime binding reads must use the bounded pool');

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
      pageInfo: { mode: 'offset', page: 1, pageSize: 200, hasMore: true },
    };
  },
  async listRuntimeBindings() {
    return {
      items: [],
      pageInfo: { mode: 'offset', page: 1, pageSize: 20, hasMore: false },
    };
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
assert.deepEqual(itemRequest, { page: 1, pageSize: 200, sort: '-sequence' });
assert.equal(refreshedItems.agentSession?.itemPageInfo?.hasMore, true);
assert.deepEqual(
  refreshedItems.agentSession?.items.map((item) => item.id),
  ['item.pagination.1', 'item.pagination.2'],
  'descending server pages must be normalized into chronological transcript order',
);

console.log('agent session pagination and refresh contract passed.');
