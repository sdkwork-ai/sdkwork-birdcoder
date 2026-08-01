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
import { subscribeWorkspaceSessionInboxSynchronization } from '../src/workbench/workspaceSessionInboxCoordinator.ts';

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

function project(initialSessions: AgentSessionView[] = []): AgentProjectView {
  return {
    projectId,
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
): ActivitySummary {
  return {
    session: {
      id: `id.${sessionId}`,
      sessionId,
      tenantId,
      organizationId,
      agentId: `agent.${sessionId}`,
      ownerUserId,
      projectId,
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

function installProject(initialSessions: AgentSessionView[] = []): string {
  const scopeKey = buildProjectsStoreScopeKey(userScope, workspaceId);
  deleteProjectsStore(scopeKey);
  upsertProjectIntoProjectsStore(project(initialSessions), userScope);
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
});
