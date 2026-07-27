import { describe, expect, it, vi } from 'vitest';
import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import type { IProjectService } from '../src/services/interfaces/IProjectService.ts';
import type { AgentSessionActivitySummaryRecord } from '../src/services/agentSessionViewModels.ts';
import {
  buildProjectsStoreScopeKey,
  deleteProjectsStore,
} from '../src/stores/projectsStore.ts';
import {
  applyProjectSessionActivityRefresh,
  refreshProjectSessions,
} from '../src/workbench/sessionRefresh.ts';

const PROJECT_ID = 'project.test';
const TENANT_ID = 'tenant.test';
const ORGANIZATION_ID = 'organization.test';
const OWNER_USER_ID = 'user.test';

function project(overrides: Partial<AgentProjectView> = {}): AgentProjectView {
  return {
    projectId: PROJECT_ID,
    workspaceId: 'workspace.test',
    tenantId: TENANT_ID,
    organizationId: ORGANIZATION_ID,
    ownerUserId: OWNER_USER_ID,
    name: 'Test project',
    visibility: 'private',
    status: 'active',
    driveAccessMode: 'disabled',
    version: '1',
    createdAt: '2026-07-27T08:00:00.000Z',
    updatedAt: '2026-07-27T08:00:00.000Z',
    agentSessions: [],
    ...overrides,
  };
}

function summary(
  sessionId: string,
  overrides: Partial<AgentSessionActivitySummaryRecord> = {},
): AgentSessionActivitySummaryRecord {
  const value = {
    session: {
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      ownerUserId: OWNER_USER_ID,
      sessionId,
      projectId: PROJECT_ID,
      agentId: `agent.${sessionId}`,
      title: sessionId,
      status: 'active',
      lastItemSequence: '0',
      createdAt: '2026-07-27T08:00:00.000Z',
      updatedAt: '2026-07-27T10:00:00.000Z',
      version: '1',
    },
    latestTurn: null,
    pendingInteraction: null,
    currentRuntimeBinding: null,
    latestRuntimeBinding: null,
    userState: null,
    providerIdentity: {
      runtimeBindingId: null,
      providerId: null,
      modelId: null,
      providerBindingId: null,
      providerSessionId: null,
      providerSessionTreeId: null,
      providerParentSessionId: null,
      providerForkedFromSessionId: null,
    },
    freshness: {
      activityAt: '2026-07-27T10:00:00.000Z',
      source: 'session',
      observedAt: null,
      freshUntil: null,
      sessionVersion: '1',
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
    ...overrides,
  };
  return value as unknown as AgentSessionActivitySummaryRecord;
}

function cursorPage(
  items: readonly AgentSessionActivitySummaryRecord[],
  overrides: Record<string, unknown> = {},
) {
  return {
    items: [...items],
    pageInfo: {
      mode: 'cursor',
      pageSize: 200,
      hasMore: false,
      nextCursor: null,
      ...overrides,
    },
  };
}

function services(
  loadedProject: AgentProjectView | null,
  page: ReturnType<typeof cursorPage>,
) {
  const listSessionActivitySummaries = vi.fn().mockResolvedValue(page);
  const listSessionsByProject = vi.fn();
  const agentSessionService = {
    listSessionActivitySummaries,
    listSessionsByProject,
  } as unknown as IAgentSessionService;
  const projectService = {
    getProjectById: vi.fn().mockResolvedValue(loadedProject),
  } as unknown as IProjectService;
  return {
    agentSessionService,
    listSessionActivitySummaries,
    listSessionsByProject,
    projectService,
  };
}

describe('manual Project Session refresh', () => {
  it('loads one bounded canonical activity head page and never calls the legacy inventory path', async () => {
    const page = cursorPage([
      summary('session.codex'),
      summary('session.claude'),
    ], {
      hasMore: true,
      nextCursor: 'next-page',
    });
    const dependencies = services(project(), page);

    const result = await refreshProjectSessions({
      agentSessionService: dependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: dependencies.projectService,
    });

    expect(dependencies.listSessionActivitySummaries).toHaveBeenCalledTimes(1);
    expect(dependencies.listSessionActivitySummaries).toHaveBeenCalledWith({
      pageSize: 200,
      projectId: PROJECT_ID,
    }, { signal: expect.any(AbortSignal) });
    expect(dependencies.listSessionsByProject).not.toHaveBeenCalled();
    expect(result.status).toBe('refreshed');
    expect(result.sessionIds).toEqual(['session.codex', 'session.claude']);
    expect(result.projects?.[0]?.agentSessions.map((candidate) => candidate.id)).toEqual([
      'session.codex',
      'session.claude',
    ]);
  });

  it('returns Session tombstones separately instead of mapping them into active rows', async () => {
    const deleted = summary('session.deleted', {
      presentationPhase: 'deleted',
      session: {
        ...summary('session.deleted').session,
        deletedAt: '2026-07-27T10:00:01.000Z',
      },
    });
    const dependencies = services(project(), cursorPage([deleted]));

    const result = await refreshProjectSessions({
      agentSessionService: dependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: dependencies.projectService,
    });

    expect(result.deletedSessionIds).toEqual(['session.deleted']);
    expect(result.deletedSessionTombstones.map((session) => session.id))
      .toEqual(['session.deleted']);
    expect(result.sessionIds).toEqual([]);
    expect(result.projects?.[0]?.agentSessions).toEqual([]);
  });

  it('rejects a Project refresh response that started before a newer tombstone', async () => {
    const sessionId = 'session.racing-project-refresh';
    const live = summary(sessionId);
    const staleDependencies = services(project(), cursorPage([live]));
    const staleResult = await refreshProjectSessions({
      agentSessionService: staleDependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: staleDependencies.projectService,
    });
    const tombstoneBase = summary(sessionId);
    const deleted = summary(sessionId, {
      freshness: {
        ...tombstoneBase.freshness,
        sessionVersion: '2',
      },
      presentationPhase: 'deleted',
      session: {
        ...tombstoneBase.session,
        deletedAt: '2026-07-27T10:01:00.000Z',
        version: '2',
      },
    });
    const deletionDependencies = services(project(), cursorPage([deleted]));
    const deletionResult = await refreshProjectSessions({
      agentSessionService: deletionDependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: deletionDependencies.projectService,
    });
    const scopeKey = buildProjectsStoreScopeKey('user.refresh-race', 'workspace.test');
    let projects = [project({
      agentSessions: staleResult.projects![0]!.agentSessions,
    })];

    projects = applyProjectSessionActivityRefresh(
      projects,
      deletionResult.projects![0]!,
      deletionResult.deletedSessionIds,
      {
        deletedSessionTombstones: deletionResult.deletedSessionTombstones,
        scopeKey,
      },
    );
    expect(projects[0]?.agentSessions).toEqual([]);

    projects = applyProjectSessionActivityRefresh(
      projects,
      staleResult.projects![0]!,
      staleResult.deletedSessionIds,
      {
        deletedSessionTombstones: staleResult.deletedSessionTombstones,
        scopeKey,
      },
    );
    expect(projects[0]?.agentSessions).toEqual([]);
    deleteProjectsStore(scopeKey);
  });

  it('does not let an older Project tombstone delete a newer activity-less Session', async () => {
    const sessionId = 'session.recreated-after-delete';
    const tombstoneBase = summary(sessionId);
    const deleted = summary(sessionId, {
      freshness: {
        ...tombstoneBase.freshness,
        sessionVersion: '2',
      },
      presentationPhase: 'deleted',
      session: {
        ...tombstoneBase.session,
        deletedAt: '2026-07-27T10:01:00.000Z',
        version: '2',
      },
    });
    const deletionDependencies = services(project(), cursorPage([deleted]));
    const deletionResult = await refreshProjectSessions({
      agentSessionService: deletionDependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: deletionDependencies.projectService,
    });
    const deletedSession = deletionResult.deletedSessionTombstones[0]!;
    const recreatedSession = {
      ...deletedSession,
      activity: undefined,
      serverVersion: '3',
      status: 'active' as const,
      updatedAt: '2026-07-27T10:02:00.000Z',
    };
    const scopeKey = buildProjectsStoreScopeKey('user.stale-delete-race', 'workspace.test');

    const committed = applyProjectSessionActivityRefresh(
      [project({ agentSessions: [recreatedSession] })],
      deletionResult.projects![0]!,
      deletionResult.deletedSessionIds,
      {
        deletedSessionTombstones: deletionResult.deletedSessionTombstones,
        scopeKey,
      },
    );

    expect(committed[0]?.agentSessions).toHaveLength(1);
    expect(committed[0]?.agentSessions[0]).toMatchObject({
      activity: undefined,
      id: sessionId,
      serverVersion: '3',
      status: 'active',
    });
    deleteProjectsStore(scopeKey);
  });

  it('commits a bounded head without dropping rows outside the head and applies tombstones', async () => {
    const dependencies = services(project(), cursorPage([summary('session.head')]));
    const result = await refreshProjectSessions({
      agentSessionService: dependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: dependencies.projectService,
    });
    const refreshedProject = result.projects![0]!;
    const head = refreshedProject.agentSessions[0]!;
    const outsideHead = {
      ...head,
      id: 'session.outside-head',
      agentId: 'agent.session.outside-head',
      title: 'Outside bounded head',
    };
    const deleted = {
      ...head,
      id: 'session.deleted',
      agentId: 'agent.session.deleted',
      title: 'Deleted',
    };

    const committed = applyProjectSessionActivityRefresh(
      [project({ agentSessions: [head, outsideHead, deleted] })],
      refreshedProject,
      ['session.deleted'],
    );

    expect(committed[0]?.agentSessions.map((session) => session.id).sort()).toEqual([
      'session.head',
      'session.outside-head',
    ]);
  });

  it('rejects a refresh that marks the same Session live and deleted', async () => {
    const dependencies = services(project(), cursorPage([summary('session.conflict')]));
    const result = await refreshProjectSessions({
      agentSessionService: dependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: dependencies.projectService,
    });

    expect(() => applyProjectSessionActivityRefresh(
      [project()],
      result.projects![0]!,
      ['session.conflict'],
    )).toThrow('conflicting live and deleted rows');
  });

  it.each([
    ['missing', null],
    ['deleted', project({ status: 'deleted' })],
  ])('fails closed for a %s Project without querying Session activity', async (_label, loadedProject) => {
    const dependencies = services(loadedProject, cursorPage([]));

    const result = await refreshProjectSessions({
      agentSessionService: dependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: dependencies.projectService,
    });

    expect(result.status).toBe('failed');
    expect(result.deletedSessionIds).toEqual([]);
    expect(dependencies.listSessionActivitySummaries).not.toHaveBeenCalled();
  });

  it('rejects invalid cursor metadata without applying a partial snapshot', async () => {
    const dependencies = services(project(), cursorPage([summary('session.test')], {
      hasMore: true,
      nextCursor: null,
    }));

    await expect(refreshProjectSessions({
      agentSessionService: dependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: dependencies.projectService,
    })).rejects.toThrow('non-progressing cursor page');
  });

  it('rejects duplicate Session identities without applying a partial snapshot', async () => {
    const dependencies = services(project(), cursorPage([
      summary('session.duplicate'),
      summary('session.duplicate'),
    ]));

    await expect(refreshProjectSessions({
      agentSessionService: dependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: dependencies.projectService,
    })).rejects.toThrow('duplicate Session identity');
  });

  it('rejects internally inconsistent freshness evidence', async () => {
    const invalidFreshness = summary('session.freshness');
    const dependencies = services(project(), cursorPage([{
      ...invalidFreshness,
      freshness: {
        ...invalidFreshness.freshness,
        observedAt: '2026-07-27T10:00:05.000Z',
        freshUntil: '2026-07-27T10:00:04.000Z',
      },
    }]));

    await expect(refreshProjectSessions({
      agentSessionService: dependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: dependencies.projectService,
    })).rejects.toThrow('freshness interval is invalid');
  });

  it.each([
    ['Project', { projectId: 'project.other' }],
    ['tenant', { tenantId: 'tenant.other' }],
    ['organization', { organizationId: 'organization.other' }],
    ['owner', { ownerUserId: 'user.other' }],
  ])('rejects a Session summary outside the requested %s scope', async (_label, sessionOverrides) => {
    const scopedSummary = summary('session.scope');
    const dependencies = services(project(), cursorPage([{
      ...scopedSummary,
      session: {
        ...scopedSummary.session,
        ...sessionOverrides,
      },
    }]));

    await expect(refreshProjectSessions({
      agentSessionService: dependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: dependencies.projectService,
    })).rejects.toThrow('escaped its requested Project scope');
  });
});
