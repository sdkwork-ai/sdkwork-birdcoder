import { describe, expect, it, vi } from 'vitest';
import type {
  AgentProjectView,
  AgentSessionItemView,
  AgentSessionView,
  AgentWorkspaceView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

import {
  mergeWorkspacePages,
  selectInitialWorkspace,
} from '../src/hooks/useWorkspaces';
import {
  buildProjectsStoreScopeKey,
  deleteProjectsStore,
  getAgentSessionTranscriptRevision,
  getProjectsStore,
  mutateProjectsStoreByScopeKey,
  PROJECT_STORE_MAX_SESSION_ITEM_CHARACTERS,
  PROJECT_STORE_MAX_SESSION_ITEMS,
  removeAgentSessionFromProjectsStore,
  updateAgentSessionInCollection,
  upsertAgentSessionIntoProjectsStore,
  upsertAgentSessionIntoProjectsStoreIfTranscriptUnchanged,
  upsertProjectIntoProjectsStore,
} from '../src/stores/projectsStore';

function createWorkspace(
  workspaceId: string,
  options: Partial<AgentWorkspaceView> = {},
): AgentWorkspaceView {
  return {
    workspaceId,
    tenantId: '100001',
    organizationId: '0',
    ownerUserId: '42',
    name: workspaceId,
    isDefault: false,
    status: 'active',
    version: '1',
    createdAt: '2026-07-25T00:00:00.000Z',
    updatedAt: '2026-07-25T00:00:00.000Z',
    ...options,
  };
}

function createProject(workspaceId: string, projectId: string): AgentProjectView {
  return {
    projectId,
    workspaceId,
    tenantId: '100001',
    organizationId: '0',
    ownerUserId: '42',
    name: projectId,
    visibility: 'private',
    status: 'active',
    driveAccessMode: 'disabled',
    version: '1',
    createdAt: '2026-07-25T00:00:00.000Z',
    updatedAt: '2026-07-25T00:00:00.000Z',
    agentSessions: [],
  };
}

function createSession(projectId: string): AgentSessionView {
  return {
    id: 'session-1',
    agentId: 'agent.code-engine.codex',
    projectId,
    title: 'Session 1',
    status: 'active',
    hostMode: 'web',
    engineId: 'codex',
    modelId: 'gpt-5',
    providerId: 'provider.openai',
    createdAt: '2026-07-25T00:00:00.000Z',
    updatedAt: '2026-07-25T00:01:00.000Z',
    displayTime: 'Just now',
    items: [],
  };
}

function createSessionItem(sequence: number, options: {
  content?: string;
  transient?: boolean;
} = {}): AgentSessionItemView {
  return {
    id: `item-${sequence}`,
    sessionId: 'session-1',
    role: 'assistant',
    content: options.content ?? `message-${sequence}`,
    createdAt: '2026-07-25T00:00:00.000Z',
    metadata: {
      agentItemSequence: String(sequence),
      ...(options.transient ? { transient: true } : {}),
    },
  };
}

describe('Workspace-scoped project inventory', () => {
  it('selects the active default Workspace unless an available preference exists', () => {
    const archivedPreferred = createWorkspace('workspace-archived', {
      status: 'archived',
    });
    const defaultWorkspace = createWorkspace('workspace-default', {
      isDefault: true,
    });
    const preferredWorkspace = createWorkspace('workspace-preferred');
    const workspaces = [archivedPreferred, defaultWorkspace, preferredWorkspace];

    expect(selectInitialWorkspace(workspaces)?.workspaceId).toBe('workspace-default');
    expect(
      selectInitialWorkspace(workspaces, preferredWorkspace.workspaceId)?.workspaceId,
    ).toBe('workspace-preferred');
  });

  it('merges paginated Workspace results by canonical Workspace id', () => {
    const original = createWorkspace('workspace-1', { name: 'Original' });
    const refreshed = createWorkspace('workspace-1', { name: 'Refreshed' });
    const next = createWorkspace('workspace-2');

    expect(mergeWorkspacePages([original], [refreshed, next])).toEqual([
      refreshed,
      next,
    ]);
  });

  it('keeps Project and Session mutations isolated by Workspace and auth session', () => {
    const userScope = '42::session:7';
    const workspaceA = 'workspace-a';
    const workspaceB = 'workspace-b';
    const projectA = createProject(workspaceA, 'project-a');
    const projectB = createProject(workspaceB, 'project-b');
    const scopeA = buildProjectsStoreScopeKey(userScope, workspaceA);
    const scopeB = buildProjectsStoreScopeKey(userScope, workspaceB);

    try {
      upsertProjectIntoProjectsStore(projectA, userScope);
      upsertProjectIntoProjectsStore(projectB, userScope);
      upsertAgentSessionIntoProjectsStore(
        projectA.projectId,
        createSession(projectA.projectId),
        workspaceA,
        userScope,
      );

      expect(getProjectsStore(scopeA).snapshot.projects).toHaveLength(1);
      expect(getProjectsStore(scopeA).snapshot.projects[0]?.agentSessions).toHaveLength(1);
      expect(getProjectsStore(scopeB).snapshot.projects).toEqual([projectB]);
    } finally {
      deleteProjectsStore(scopeA);
      deleteProjectsStore(scopeB);
    }
  });

  it('does not publish or replace collection identities for no-op Session updates', () => {
    const userScope = '42::session:7';
    const project = createProject('workspace-a', 'project-a');
    const session = createSession(project.projectId);
    const scopeKey = buildProjectsStoreScopeKey(userScope, project.workspaceId);

    try {
      upsertProjectIntoProjectsStore(project, userScope);
      upsertAgentSessionIntoProjectsStore(
        project.projectId,
        session,
        project.workspaceId,
        userScope,
      );
      const store = getProjectsStore(scopeKey);
      const listener = vi.fn();
      store.listeners.add(listener);
      const snapshotBefore = store.snapshot;
      const projectsBefore = snapshotBefore.projects;
      const projectBefore = projectsBefore[0]!;
      const sessionsBefore = projectBefore.agentSessions;
      const sessionBefore = sessionsBefore[0]!;

      mutateProjectsStoreByScopeKey(scopeKey, (projects) =>
        updateAgentSessionInCollection(
          projects,
          project.projectId,
          session.id,
          (currentSession) => currentSession,
        ),
      );
      mutateProjectsStoreByScopeKey(scopeKey, (projects) =>
        updateAgentSessionInCollection(
          projects,
          project.projectId,
          session.id,
          (currentSession) => ({
            ...currentSession,
            items: [...currentSession.items],
          }),
        ),
      );

      expect(store.snapshot).toBe(snapshotBefore);
      expect(store.snapshot.projects).toBe(projectsBefore);
      expect(store.snapshot.projects[0]).toBe(projectBefore);
      expect(store.snapshot.projects[0]?.agentSessions).toBe(sessionsBefore);
      expect(store.snapshot.projects[0]?.agentSessions[0]).toBe(sessionBefore);
      expect(listener).not.toHaveBeenCalled();
      store.listeners.delete(listener);
    } finally {
      deleteProjectsStore(scopeKey);
    }
  });

  it('atomically commits recovered Session data without truncating project inventory', () => {
    const userScope = '42::session:7';
    const project = createProject('workspace-a', 'project-a');
    const scopeKey = buildProjectsStoreScopeKey(userScope, project.workspaceId);
    const selectedSession = createSession(project.projectId);
    const headSession = {
      ...createSession(project.projectId),
      id: 'session-head',
      title: 'Head Session',
    };
    const olderSession = {
      ...createSession(project.projectId),
      id: 'session-older',
      title: 'Older Session',
    };

    try {
      upsertProjectIntoProjectsStore({
        ...project,
        agentSessions: [selectedSession, headSession, olderSession],
      }, userScope);
      const store = getProjectsStore(scopeKey);
      const observedSessionIds: string[][] = [];
      const listener = () => {
        observedSessionIds.push(
          store.snapshot.projects[0]?.agentSessions.map((session) => session.id) ?? [],
        );
      };
      store.listeners.add(listener);

      upsertAgentSessionIntoProjectsStore(
        project.projectId,
        { ...selectedSession, updatedAt: '2026-07-25T00:02:00.000Z' },
        project.workspaceId,
        userScope,
        {
          itemMergeMode: 'latest',
          projectMetadata: {
            ...project,
            agentSessions: [headSession],
            name: 'Refreshed Project',
          },
        },
      );

      store.listeners.delete(listener);
      expect(observedSessionIds).toHaveLength(1);
      expect(observedSessionIds[0]).toEqual(expect.arrayContaining([
        selectedSession.id,
        headSession.id,
        olderSession.id,
      ]));
      expect(observedSessionIds[0]).toHaveLength(3);
      expect(store.snapshot.projects[0]?.name).toBe('Refreshed Project');
    } finally {
      deleteProjectsStore(scopeKey);
    }
  });

  it('rejects a Project store scope without a Workspace id', () => {
    expect(() => buildProjectsStoreScopeKey('42::session:7', ' ')).toThrow(
      'Workspace ID is required for the Projects store scope.',
    );
  });

  it('evicts a confirmed stale Session only from its guarded Workspace scope', () => {
    const userScope = '42::session:7';
    const projectId = 'project-shared';
    const projectA = createProject('workspace-a', projectId);
    const projectB = createProject('workspace-b', projectId);
    const scopeA = buildProjectsStoreScopeKey(userScope, projectA.workspaceId);
    const scopeB = buildProjectsStoreScopeKey(userScope, projectB.workspaceId);
    const agentSession = createSession(projectId);

    try {
      upsertProjectIntoProjectsStore(projectA, userScope);
      upsertProjectIntoProjectsStore(projectB, userScope);
      upsertAgentSessionIntoProjectsStore(
        projectId,
        agentSession,
        projectA.workspaceId,
        userScope,
      );
      upsertAgentSessionIntoProjectsStore(
        projectId,
        agentSession,
        projectB.workspaceId,
        userScope,
      );

      expect(removeAgentSessionFromProjectsStore(
        scopeA,
        projectId,
        agentSession.id,
        'agent.recreated',
      )).toBe('identity-mismatch');
      expect(getProjectsStore(scopeA).snapshot.projects[0]?.agentSessions)
        .toHaveLength(1);
      expect(getProjectsStore(scopeA).snapshot.projects[0]?.agentSessions[0])
        .toMatchObject({ agentId: agentSession.agentId, id: agentSession.id });

      const revisionBeforeRemoval = getAgentSessionTranscriptRevision(
        scopeA,
        projectId,
        agentSession.id,
      );
      let observedRemovalRevision = -1;
      const listener = () => {
        observedRemovalRevision = getAgentSessionTranscriptRevision(
          scopeA,
          projectId,
          agentSession.id,
        );
      };
      getProjectsStore(scopeA).listeners.add(listener);
      expect(removeAgentSessionFromProjectsStore(
        scopeA,
        projectId,
        agentSession.id,
        agentSession.agentId,
      )).toBe('removed');
      getProjectsStore(scopeA).listeners.delete(listener);
      expect(observedRemovalRevision).toBe(revisionBeforeRemoval + 1);
      expect(getProjectsStore(scopeA).snapshot.projects[0]?.agentSessions).toEqual([]);
      expect(getProjectsStore(scopeB).snapshot.projects[0]?.agentSessions)
        .toHaveLength(1);
      expect(getProjectsStore(scopeB).snapshot.projects[0]?.agentSessions[0])
        .toMatchObject({ agentId: agentSession.agentId, id: agentSession.id });
    } finally {
      deleteProjectsStore(scopeA);
      deleteProjectsStore(scopeB);
    }
  });

  it('rejects a stale history page after the authority transcript window resets', () => {
    const userScope = '42::session:7';
    const project = createProject('workspace-a', 'project-a');
    const scopeKey = buildProjectsStoreScopeKey(userScope, project.workspaceId);
    const initialSession = {
      ...createSession(project.projectId),
      itemPageInfo: { hasMore: true, nextCursor: 'cursor.5', pageSize: 50 },
    };

    try {
      upsertProjectIntoProjectsStore(project, userScope);
      upsertAgentSessionIntoProjectsStore(
        project.projectId,
        initialSession,
        project.workspaceId,
        userScope,
        { itemMergeMode: 'authority-window-reset' },
      );
      const expected = {
        agentId: initialSession.agentId,
        hasMore: initialSession.itemPageInfo.hasMore,
        nextCursor: initialSession.itemPageInfo.nextCursor,
        pageSize: initialSession.itemPageInfo.pageSize,
        revision: getAgentSessionTranscriptRevision(
          scopeKey,
          project.projectId,
          initialSession.id,
        ),
      };

      upsertAgentSessionIntoProjectsStore(
        project.projectId,
        { ...initialSession, updatedAt: '2026-07-25T00:02:00.000Z' },
        project.workspaceId,
        userScope,
        { itemMergeMode: 'authority-window-reset' },
      );

      expect(upsertAgentSessionIntoProjectsStoreIfTranscriptUnchanged(
        project.projectId,
        {
          ...initialSession,
          itemPageInfo: { hasMore: false, nextCursor: null, pageSize: 50 },
          updatedAt: '2026-07-25T00:03:00.000Z',
        },
        project.workspaceId,
        userScope,
        expected,
        { itemMergeMode: 'ordered-window' },
      )).toBe(false);
      expect(getProjectsStore(scopeKey).snapshot.projects[0]?.agentSessions[0]?.itemPageInfo)
        .toEqual(initialSession.itemPageInfo);
    } finally {
      deleteProjectsStore(scopeKey);
    }
  });

  it('advances the transcript revision for every authority window reset', () => {
    const userScope = '42::session:7';
    const project = createProject('workspace-a', 'project-a');
    const scopeKey = buildProjectsStoreScopeKey(userScope, project.workspaceId);
    const agentSession = {
      ...createSession(project.projectId),
      itemPageInfo: { hasMore: true, nextCursor: 'cursor.2', pageSize: 50 },
    };

    try {
      upsertProjectIntoProjectsStore(project, userScope);
      upsertAgentSessionIntoProjectsStore(
        project.projectId,
        agentSession,
        project.workspaceId,
        userScope,
        { itemMergeMode: 'authority-window-reset' },
      );
      const firstRevision = getAgentSessionTranscriptRevision(
        scopeKey,
        project.projectId,
        agentSession.id,
      );

      upsertAgentSessionIntoProjectsStore(
        project.projectId,
        agentSession,
        project.workspaceId,
        userScope,
        { itemMergeMode: 'authority-window-reset' },
      );

      expect(getAgentSessionTranscriptRevision(
        scopeKey,
        project.projectId,
        agentSession.id,
      )).toBe(firstRevision + 1);
    } finally {
      deleteProjectsStore(scopeKey);
    }
  });

  it('commits a history page only against the exact transcript snapshot', () => {
    const userScope = '42::session:7';
    const project = createProject('workspace-a', 'project-a');
    const scopeKey = buildProjectsStoreScopeKey(userScope, project.workspaceId);
    const agentSession = {
      ...createSession(project.projectId),
      itemPageInfo: { hasMore: true, nextCursor: 'cursor.2', pageSize: 50 },
    };
    const historyPage = {
      ...agentSession,
      itemPageInfo: { hasMore: false, nextCursor: null, pageSize: 50 },
    };

    try {
      upsertProjectIntoProjectsStore(project, userScope);
      upsertAgentSessionIntoProjectsStore(
        project.projectId,
        agentSession,
        project.workspaceId,
        userScope,
        { itemMergeMode: 'authority-window-reset' },
      );
      const expected = {
        agentId: agentSession.agentId,
        hasMore: agentSession.itemPageInfo.hasMore,
        nextCursor: agentSession.itemPageInfo.nextCursor,
        pageSize: agentSession.itemPageInfo.pageSize,
        revision: getAgentSessionTranscriptRevision(
          scopeKey,
          project.projectId,
          agentSession.id,
        ),
      };
      const commit = (
        incomingSession: AgentSessionView,
        snapshot = expected,
      ) => upsertAgentSessionIntoProjectsStoreIfTranscriptUnchanged(
        project.projectId,
        incomingSession,
        project.workspaceId,
        userScope,
        snapshot,
        { itemMergeMode: 'ordered-window' },
      );

      expect(commit(
        { ...historyPage, agentId: 'agent.code-engine.stale' },
      )).toBe(false);
      expect(commit({ ...historyPage, projectId: 'project-stale' })).toBe(false);
      expect(commit({
        ...historyPage,
        itemPageInfo: {
          ...historyPage.itemPageInfo,
          hasMore: true,
          nextCursor: expected.nextCursor,
        },
      })).toBe(false);
      expect(commit({
        ...historyPage,
        itemPageInfo: { ...historyPage.itemPageInfo, pageSize: 20 },
      })).toBe(false);
      expect(commit(historyPage, { ...expected, agentId: 'agent.code-engine.stale' }))
        .toBe(false);
      expect(commit(historyPage, { ...expected, hasMore: false })).toBe(false);
      expect(commit(historyPage, { ...expected, nextCursor: 'cursor.stale' })).toBe(false);
      expect(commit(historyPage, { ...expected, pageSize: 20 })).toBe(false);
      expect(commit(historyPage, { ...expected, revision: expected.revision - 1 }))
        .toBe(false);
      expect(commit(historyPage)).toBe(true);
      expect(getProjectsStore(scopeKey).snapshot.projects[0]?.agentSessions[0]?.itemPageInfo)
        .toEqual(historyPage.itemPageInfo);
    } finally {
      deleteProjectsStore(scopeKey);
    }
  });

  it('bounds retained transcript items without advancing beyond the recoverable cursor', () => {
    const userScope = '42::bounded-transcript';
    const project = createProject('workspace-bounded', 'project-bounded');
    const scopeKey = buildProjectsStoreScopeKey(userScope, project.workspaceId);
    const latestItems = Array.from(
      { length: PROJECT_STORE_MAX_SESSION_ITEMS },
      (_, index) => createSessionItem(index + 51),
    );
    const initialSession = {
      ...createSession(project.projectId),
      itemPageInfo: { hasMore: true, nextCursor: 'cursor.recoverable', pageSize: 50 },
      items: latestItems,
    };

    try {
      upsertProjectIntoProjectsStore(project, userScope);
      upsertAgentSessionIntoProjectsStore(
        project.projectId,
        initialSession,
        project.workspaceId,
        userScope,
        { itemMergeMode: 'authority-window-reset' },
      );
      upsertAgentSessionIntoProjectsStore(
        project.projectId,
        {
          ...initialSession,
          itemPageInfo: { hasMore: true, nextCursor: 'cursor.discarded', pageSize: 50 },
          items: Array.from({ length: 550 }, (_, index) => createSessionItem(index + 1)),
        },
        project.workspaceId,
        userScope,
        { itemMergeMode: 'ordered-window' },
      );

      const retained = getProjectsStore(scopeKey).snapshot.projects[0]?.agentSessions[0];
      expect(retained?.items).toHaveLength(PROJECT_STORE_MAX_SESSION_ITEMS);
      expect(retained?.items[0]?.id).toBe('item-51');
      expect(retained?.items.at(-1)?.id).toBe('item-550');
      expect(retained?.itemPageInfo).toEqual({
        hasMore: true,
        nextCursor: 'cursor.recoverable',
        pageSize: 50,
        retentionLimitReached: true,
      });
    } finally {
      deleteProjectsStore(scopeKey);
    }
  });

  it('prioritizes transient items and enforces the transcript character budget', () => {
    const userScope = '42::bounded-transient';
    const project = createProject('workspace-bounded', 'project-transient');
    const scopeKey = buildProjectsStoreScopeKey(userScope, project.workspaceId);
    const transient = createSessionItem(0, { transient: true });
    const oversizedWindow = [
      transient,
      ...Array.from(
        { length: PROJECT_STORE_MAX_SESSION_ITEMS },
        (_, index) => createSessionItem(index + 1, { content: 'x'.repeat(10_000) }),
      ),
    ];

    try {
      upsertProjectIntoProjectsStore(project, userScope);
      upsertAgentSessionIntoProjectsStore(
        project.projectId,
        {
          ...createSession(project.projectId),
          itemPageInfo: { hasMore: true, nextCursor: 'cursor.older', pageSize: 50 },
          items: oversizedWindow,
        },
        project.workspaceId,
        userScope,
        { itemMergeMode: 'authority-window-reset' },
      );

      const retained = getProjectsStore(scopeKey).snapshot.projects[0]?.agentSessions[0];
      expect(retained?.items).toContain(transient);
      expect(retained!.items.length).toBeLessThan(PROJECT_STORE_MAX_SESSION_ITEMS);
      expect(retained!.items.reduce((total, item) => total + item.content.length, 0))
        .toBeLessThanOrEqual(PROJECT_STORE_MAX_SESSION_ITEM_CHARACTERS);
      expect(retained?.itemPageInfo?.retentionLimitReached).toBe(true);
    } finally {
      deleteProjectsStore(scopeKey);
    }
  });

  it('does not treat bounded deeply nested provider metadata as an exhausted transcript window', () => {
    const userScope = '42::bounded-provider-metadata';
    const project = createProject('workspace-bounded', 'project-provider-metadata');
    const scopeKey = buildProjectsStoreScopeKey(userScope, project.workspaceId);
    let providerPayload: Record<string, unknown> = { value: 'completed' };
    for (let depth = 0; depth < 32; depth += 1) {
      providerPayload = { child: providerPayload };
    }
    const item = createSessionItem(1);

    try {
      upsertProjectIntoProjectsStore(project, userScope);
      upsertAgentSessionIntoProjectsStore(
        project.projectId,
        {
          ...createSession(project.projectId),
          itemPageInfo: { hasMore: true, nextCursor: 'cursor.older', pageSize: 50 },
          items: [{
            ...item,
            metadata: {
              ...item.metadata,
              providerPayload,
            },
          }],
        },
        project.workspaceId,
        userScope,
        { itemMergeMode: 'authority-window-reset' },
      );

      const retained = getProjectsStore(scopeKey).snapshot.projects[0]?.agentSessions[0];
      expect(retained?.items).toHaveLength(1);
      expect(retained?.itemPageInfo).toEqual({
        hasMore: true,
        nextCursor: 'cursor.older',
        pageSize: 50,
      });
    } finally {
      deleteProjectsStore(scopeKey);
    }
  });
});
