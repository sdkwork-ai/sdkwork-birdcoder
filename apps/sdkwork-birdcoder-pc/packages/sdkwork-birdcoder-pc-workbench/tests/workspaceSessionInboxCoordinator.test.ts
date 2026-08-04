import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentProjectView,
  AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  AgentSessionActivityPageRequest,
  AgentSessionReadOptions,
  IAgentSessionService,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import type { AgentSessionActivitySummaryRecord } from '../src/services/agentSessionViewModels.ts';
import {
  buildProjectsStoreScopeKey,
  deleteProjectsStore,
  getProjectsStore,
  upsertProjectIntoProjectsStore,
} from '../src/stores/projectsStore.ts';
import {
  subscribeWorkspaceSessionInboxSynchronization,
} from '../src/workbench/workspaceSessionInboxCoordinator.ts';
import { WORKSPACE_SESSION_INBOX_MAX_CACHED_SESSIONS } from '../src/workbench/workspaceSessionInboxSync.ts';

const userScope = 'user.session-inbox';
const workspaceId = 'workspace.session-inbox';
const projectId = 'project.session-inbox';
const tenantId = '1001';
const organizationId = '2001';
const ownerUserId = '3001';
const createdAt = '2026-07-27T00:00:00.000Z';
const freshUntil = '2099-07-27T00:05:00.000Z';

type ActivitySummary = AgentSessionActivitySummaryRecord;

function session(
  sessionId: string,
  serverVersion: string,
  updatedAt: string,
): AgentSessionView {
  return {
    id: sessionId,
    agentId: `agent.${sessionId}`,
    projectId,
    title: sessionId,
    status: 'active',
    hostMode: 'web',
    engineId: 'codex',
    modelId: 'codex-default',
    providerId: 'provider.openai',
    runtimeStatus: 'ready',
    createdAt,
    updatedAt,
    displayTime: 'Just now',
    serverVersion,
    items: [],
  };
}

function project(initialSessions: AgentSessionView[] = [], targetProjectId = projectId): AgentProjectView {
  return {
    projectId: targetProjectId,
    workspaceId,
    tenantId,
    organizationId,
    ownerUserId,
    name: 'Session Inbox project',
    visibility: 'private',
    status: 'active',
    driveAccessMode: 'disabled',
    version: '1',
    createdAt,
    updatedAt: createdAt,
    agentSessions: initialSessions,
  };
}

function summary(
  sessionId: string,
  version: string,
  updatedAt: string,
  targetProjectId = projectId,
): ActivitySummary {
  return {
    session: {
      id: `id.${sessionId}`,
      sessionId,
      tenantId,
      organizationId,
      agentId: `agent.${sessionId}`,
      ownerUserId,
      projectId: targetProjectId,
      sessionKind: 'coding',
      entrySurface: 'pc',
      title: sessionId,
      titleSource: 'system',
      status: 'active',
      itemCount: version,
      lastItemSequence: version,
      totalInputTokens: '0',
      totalOutputTokens: '0',
      createdBy: ownerUserId,
      updatedBy: ownerUserId,
      version,
      createdAt,
      updatedAt,
      lastItemAt: updatedAt,
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
      activityAt: updatedAt,
      source: 'session',
      observedAt: updatedAt,
      freshUntil,
      sessionVersion: version,
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
    presentationPhase: 'ready',
  };
}

function page(
  items: ActivitySummary[],
  options: { hasMore?: boolean; nextCursor?: string | null } = {},
) {
  return {
    items,
    pageInfo: {
      mode: 'cursor' as const,
      pageSize: 100,
      hasMore: options.hasMore ?? false,
      nextCursor: options.nextCursor ?? null,
    },
  };
}

function installProject(
  initialSessions: AgentSessionView[] = [],
  targetProjectId = projectId,
): string {
  const scopeKey = buildProjectsStoreScopeKey(userScope, workspaceId);
  deleteProjectsStore(scopeKey);
  upsertProjectIntoProjectsStore(project(initialSessions, targetProjectId), userScope);
  return scopeKey;
}

function serviceWith(
  implementation: (
    request: AgentSessionActivityPageRequest,
    options?: AgentSessionReadOptions,
  ) => ReturnType<IAgentSessionService['listSessionActivitySummaries']>,
): IAgentSessionService {
  return {
    listSessionActivitySummaries: vi.fn(implementation),
  } as unknown as IAgentSessionService;
}

function providerSynchronizingServiceWith(
  implementation: (
    request: AgentSessionActivityPageRequest,
    options?: AgentSessionReadOptions,
  ) => ReturnType<IAgentSessionService['listSessionActivitySummaries']>,
  providerSynchronization: () => Promise<{ projectId: string }>,
): IAgentSessionService {
  return {
    listSessionActivitySummaries: vi.fn(implementation),
    synchronizeProjectSessions: vi.fn(providerSynchronization),
  } as unknown as IAgentSessionService;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Workspace Session Inbox coordinator', () => {
  it('rejects cross-page duplicate Sessions without committing a partial snapshot', async () => {
    const scopeKey = installProject();
    const duplicateSessionId = 'session.cross-page-duplicate';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = serviceWith(async (request) => request.cursor === undefined
      ? page([
          summary(duplicateSessionId, '1', '2026-07-27T00:00:01.000Z'),
        ], { hasMore: true, nextCursor: 'duplicate-cursor' })
      : page([
          summary(duplicateSessionId, '2', '2026-07-27T00:00:02.000Z'),
        ]));
    const subscription = subscribeWorkspaceSessionInboxSynchronization(
      service,
      { userScope, workspaceId },
    );

    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalledOnce());
    expect(getProjectsStore(scopeKey).snapshot.projects[0]?.agentSessions).toEqual([]);

    subscription.dispose();
    errorSpy.mockRestore();
    deleteProjectsStore(scopeKey);
  });

  it('loads every page from the current head cursor before committing the snapshot', async () => {
    const scopeKey = installProject();
    const calls: Array<string | undefined> = [];
    const service = serviceWith(async (request) => {
      calls.push(request.cursor);
      if (request.cursor === undefined) {
        return page([
          summary('session.head', '1', '2026-07-27T00:00:01.000Z'),
        ], { hasMore: true, nextCursor: 'cursor.1' });
      }
      if (request.cursor === 'cursor.1') {
        return page([
          summary('session.middle', '2', '2026-07-27T00:00:02.000Z'),
        ], { hasMore: true, nextCursor: 'cursor.2' });
      }
      if (request.cursor === 'cursor.2') {
        return page([
          summary('session.tail', '3', '2026-07-27T00:00:03.000Z'),
        ]);
      }
      throw new Error(`Unexpected cursor ${request.cursor}.`);
    });
    const subscription = subscribeWorkspaceSessionInboxSynchronization(
      service,
      { userScope, workspaceId },
    );

    await vi.waitFor(() => expect(calls).toEqual([undefined, 'cursor.1', 'cursor.2']));
    expect(
      getProjectsStore(scopeKey).snapshot.projects[0]?.agentSessions
        .map((item) => item.id)
        .sort(),
    ).toEqual([
      'session.head',
      'session.middle',
      'session.tail',
    ]);

    subscription.dispose();
    deleteProjectsStore(scopeKey);
  });

  it('deduplicates subscribers and suppresses a superseded response at Store commit time', async () => {
    const targetSessionId = 'session.superseded';
    const scopeKey = installProject([
      session(targetSessionId, '0', '2026-07-27T00:00:00.000Z'),
    ]);
    let firstSignal: AbortSignal | undefined;
    let resolveFirst: ((value: ReturnType<typeof page>) => void) | undefined;
    const listSessionActivitySummaries = vi.fn((
      _request: AgentSessionActivityPageRequest,
      options?: AgentSessionReadOptions,
    ) => {
      if (listSessionActivitySummaries.mock.calls.length === 1) {
        firstSignal = options?.signal;
        return new Promise<ReturnType<typeof page>>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve(page([
        summary(targetSessionId, '2', '2026-07-27T00:00:02.000Z'),
      ]));
    });
    const service = {
      listSessionActivitySummaries,
    } as unknown as IAgentSessionService;
    const firstSubscription = subscribeWorkspaceSessionInboxSynchronization(
      service,
      { userScope, workspaceId },
    );
    const secondSubscription = subscribeWorkspaceSessionInboxSynchronization(
      service,
      { userScope, workspaceId },
    );
    await vi.waitFor(() => expect(listSessionActivitySummaries).toHaveBeenCalledTimes(1));

    await secondSubscription.invalidate({ broadcast: false });
    expect(firstSignal?.aborted).toBe(true);
    expect(
      getProjectsStore(scopeKey).snapshot.projects[0]?.agentSessions[0]?.serverVersion,
    ).toBe('2');

    resolveFirst?.(page([
      summary(targetSessionId, '1', '2026-07-27T00:00:01.000Z'),
    ]));
    await Promise.resolve();
    await Promise.resolve();
    expect(
      getProjectsStore(scopeKey).snapshot.projects[0]?.agentSessions[0]?.serverVersion,
    ).toBe('2');
    expect(listSessionActivitySummaries.mock.calls.map(([request]) => request.cursor))
      .toEqual([undefined, undefined]);

    firstSubscription.dispose();
    secondSubscription.dispose();
    deleteProjectsStore(scopeKey);
  });

  it('synchronizes provider Session inventories before reading the activity snapshot', async () => {
    const synchronizedProjectId = 'project.session-inbox-sync';
    const scopeKey = installProject([], synchronizedProjectId);
    const synchronizeProjectSessions = vi.fn(async () => ({
      failedSessionCount: '0',
      issues: [],
      projectId: synchronizedProjectId,
      skippedSessionCount: '0',
      synchronizedSessionCount: '1',
    }));
    const listSessionActivitySummaries = vi.fn(async () => page([
      summary('session.provider-synced', '1', '2026-07-27T00:00:01.000Z', synchronizedProjectId),
    ]));
    const service = providerSynchronizingServiceWith(
      listSessionActivitySummaries,
      synchronizeProjectSessions,
    );
    const subscription = subscribeWorkspaceSessionInboxSynchronization(
      service,
      { userScope, workspaceId },
    );

    await vi.waitFor(() => expect(synchronizeProjectSessions).toHaveBeenCalledWith(
      synchronizedProjectId,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));
    await vi.waitFor(() => expect(listSessionActivitySummaries).toHaveBeenCalled());
    await vi.waitFor(() => expect(
      getProjectsStore(scopeKey).snapshot.projects[0]?.agentSessions[0]?.id,
    ).toBe('session.provider-synced'));

    subscription.dispose();
    deleteProjectsStore(scopeKey);
  });

  it('deduplicates provider Session inventory synchronization within the cache TTL', async () => {
    const synchronizedProjectId = 'project.session-inbox-dedupe';
    const scopeKey = installProject([], synchronizedProjectId);
    const synchronizeProjectSessions = vi.fn(async () => ({
      failedSessionCount: '0',
      issues: [],
      projectId: synchronizedProjectId,
      skippedSessionCount: '0',
      synchronizedSessionCount: '1',
    }));
    const service = providerSynchronizingServiceWith(
      async () => page([]),
      synchronizeProjectSessions,
    );
    const subscription = subscribeWorkspaceSessionInboxSynchronization(
      service,
      { userScope, workspaceId },
    );

    await vi.waitFor(() => expect(synchronizeProjectSessions).toHaveBeenCalledTimes(1));
    await subscription.invalidate({ broadcast: false });
    await vi.waitFor(() => expect(
      synchronizeProjectSessions.mock.calls.length,
    ).toBeGreaterThanOrEqual(1));
    // The forced refresh stays within the 60s TTL, so the provider inventory
    // pass must not issue a second backend synchronization for the project.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(synchronizeProjectSessions).toHaveBeenCalledTimes(1);

    subscription.dispose();
    deleteProjectsStore(scopeKey);
  });

  it('keeps reading the activity snapshot when provider inventory synchronization fails', async () => {
    const synchronizedProjectId = 'project.session-inbox-failure';
    const scopeKey = installProject([], synchronizedProjectId);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const synchronizeProjectSessions = vi.fn(async () => {
      throw new Error('Provider inventory unavailable.');
    });
    const service = providerSynchronizingServiceWith(
      async () => page([
        summary('session.feed-still-read', '1', '2026-07-27T00:00:01.000Z', synchronizedProjectId),
      ]),
      synchronizeProjectSessions,
    );
    const subscription = subscribeWorkspaceSessionInboxSynchronization(
      service,
      { userScope, workspaceId },
    );

    await vi.waitFor(() => expect(
      getProjectsStore(scopeKey).snapshot.projects[0]?.agentSessions[0]?.id,
    ).toBe('session.feed-still-read'));
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to synchronize some Agents project provider Session inventories',
      expect.arrayContaining([expect.objectContaining({ projectId: synchronizedProjectId })]),
    );

    subscription.dispose();
    errorSpy.mockRestore();
    deleteProjectsStore(scopeKey);
  });

  it('logs incomplete provider inventory synchronization outcomes for diagnosis', async () => {
    const synchronizedProjectId = 'project.session-inbox-issues';
    const scopeKey = installProject([], synchronizedProjectId);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const synchronizeProjectSessions = vi.fn(async () => ({
      failedSessionCount: '1',
      issues: [{
        code: 'synchronization_time_budget_exceeded',
        count: '1',
        disposition: 'failed',
      }],
      projectId: synchronizedProjectId,
      skippedSessionCount: '0',
      synchronizedSessionCount: '12',
    }));
    const service = providerSynchronizingServiceWith(
      async () => page([]),
      synchronizeProjectSessions,
    );
    const subscription = subscribeWorkspaceSessionInboxSynchronization(
      service,
      { userScope, workspaceId },
    );

    await vi.waitFor(() => expect(synchronizeProjectSessions).toHaveBeenCalledTimes(1));
    expect(warnSpy).toHaveBeenCalledWith(
      'Agents project provider Session inventory synchronization reported issues',
      expect.objectContaining({
        failedSessionCount: '1',
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'synchronization_time_budget_exceeded' }),
        ]),
        projectId: synchronizedProjectId,
      }),
    );

    subscription.dispose();
    warnSpy.mockRestore();
    deleteProjectsStore(scopeKey);
  });

  it('stops dispatching provider inventory synchronization after the cycle budget and still reads the snapshot', async () => {
    vi.useFakeTimers();
    const budgetedProjects = [
      'project.session-inbox-budget-1',
      'project.session-inbox-budget-2',
      'project.session-inbox-budget-3',
    ];
    for (const targetProjectId of budgetedProjects) {
      upsertProjectIntoProjectsStore(project([], targetProjectId), userScope);
    }
    const scopeKey = buildProjectsStoreScopeKey(userScope, workspaceId);
    const synchronizeProjectSessions = vi.fn(async (targetProjectId?: string) => {
      const resolvedProjectId = targetProjectId ?? '';
      // The first two projects reconcile slowly; the third would be next in
      // the dispatch queue only after the 10s cycle budget has expired.
      await new Promise((resolve) => setTimeout(resolve, resolvedProjectId === budgetedProjects[0]
        || resolvedProjectId === budgetedProjects[1]
        ? 12_000
        : 0));
      return {
        failedSessionCount: '0',
        issues: [],
        projectId: resolvedProjectId,
        skippedSessionCount: '0',
        synchronizedSessionCount: '1',
      };
    });
    const listSessionActivitySummaries = vi.fn(async () => page([]));
    const service = providerSynchronizingServiceWith(
      listSessionActivitySummaries,
      synchronizeProjectSessions,
    );
    const subscription = subscribeWorkspaceSessionInboxSynchronization(
      service,
      { userScope, workspaceId },
    );

    // Dispatch the first two projects, then let the slow reconciles finish
    // past the 10s budget: the third project must not be dispatched in this
    // cycle, and the activity snapshot read must still run.
    await vi.advanceTimersByTimeAsync(0);
    expect(synchronizeProjectSessions).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(12_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(synchronizeProjectSessions).toHaveBeenCalledTimes(2);
    expect(synchronizeProjectSessions.mock.calls.map(([projectId]) => projectId)).toEqual([
      budgetedProjects[0],
      budgetedProjects[1],
    ]);
    expect(listSessionActivitySummaries).toHaveBeenCalledTimes(1);
    expect(getProjectsStore(scopeKey).snapshot.projects.length).toBe(3);

    subscription.dispose();
    deleteProjectsStore(scopeKey);
    vi.useRealTimers();
  });

  it('synchronizes provider inventories for every loaded project beyond a fixed per-cycle cap', async () => {
    vi.useFakeTimers();
    const manyProjectIds = Array.from({ length: 205 }, (_, index) =>
      `project.session-inbox-many-${index}`);
    for (const targetProjectId of manyProjectIds) {
      upsertProjectIntoProjectsStore(project([], targetProjectId), userScope);
    }
    const scopeKey = buildProjectsStoreScopeKey(userScope, workspaceId);
    const synchronizeProjectSessions = vi.fn(async (targetProjectId?: string) => ({
      failedSessionCount: '0',
      issues: [],
      projectId: targetProjectId ?? '',
      skippedSessionCount: '0',
      synchronizedSessionCount: '1',
    }));
    const service = providerSynchronizingServiceWith(
      async () => page([]),
      synchronizeProjectSessions,
    );
    const subscription = subscribeWorkspaceSessionInboxSynchronization(
      service,
      { userScope, workspaceId },
    );

    await vi.advanceTimersByTimeAsync(0);
    // Every project must be reached within the cycle budget; a fixed
    // per-cycle project cap would starve the tail of a large inventory.
    expect(synchronizeProjectSessions).toHaveBeenCalledTimes(205);
    expect(new Set(synchronizeProjectSessions.mock.calls.map(([projectId]) => projectId)).size)
      .toBe(205);

    subscription.dispose();
    deleteProjectsStore(scopeKey);
    vi.useRealTimers();
  });

  it('truncates the workspace snapshot at the cache cap instead of failing the synchronization', async () => {
    // Ten thousand Sessions spread over one hundred projects keep the store
    // commit cost linear while exercising the full cap traversal.
    const capProjects = Array.from({ length: 100 }, (_, index) =>
      `project.session-inbox-cap-${index}`);
    for (const targetProjectId of capProjects) {
      upsertProjectIntoProjectsStore(project([], targetProjectId), userScope);
    }
    const scopeKey = buildProjectsStoreScopeKey(userScope, workspaceId);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let pageIndex = 0;
    const listSessionActivitySummaries = vi.fn(async () => {
      const offset = pageIndex * 100;
      pageIndex += 1;
      return page(
        Array.from({ length: 100 }, (_, index) => {
          const globalIndex = offset + index;
          return summary(
            `session.cap.${String(globalIndex).padStart(7, '0')}`,
            '1',
            '2026-07-27T00:00:00.000Z',
            capProjects[globalIndex % capProjects.length],
          );
        }),
        { hasMore: true, nextCursor: `cursor.${pageIndex}` },
      );
    });
    const service = serviceWith(listSessionActivitySummaries);
    const subscription = subscribeWorkspaceSessionInboxSynchronization(
      service,
      { userScope, workspaceId },
    );

    // The traversal stops once the cumulative page size reaches the cache
    // cap (100 pages of 100): no further page is requested, the truncation
    // is announced, and the synchronization does not fail.
    await vi.waitFor(() => expect(
      listSessionActivitySummaries,
    ).toHaveBeenCalledTimes(WORKSPACE_SESSION_INBOX_MAX_CACHED_SESSIONS / 100));
    expect(warnSpy).toHaveBeenCalledWith(
      `Agents Workspace Session activity snapshot truncated at ${WORKSPACE_SESSION_INBOX_MAX_CACHED_SESSIONS} Sessions.`,
    );
    expect(errorSpy).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(listSessionActivitySummaries).toHaveBeenCalledTimes(
      WORKSPACE_SESSION_INBOX_MAX_CACHED_SESSIONS / 100,
    );
    await vi.waitFor(() => expect(
      getProjectsStore(scopeKey).snapshot.projects[0]?.agentSessions.length,
    ).toBe(WORKSPACE_SESSION_INBOX_MAX_CACHED_SESSIONS / capProjects.length));

    subscription.dispose();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    deleteProjectsStore(scopeKey);
  }, 30_000);
});
