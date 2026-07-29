// @vitest-environment jsdom

import { act } from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  IAgentSessionService,
  IProjectService,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useImportedProjectSessionSynchronization } from '../src/hooks/useImportedProjectSessionSynchronization.ts';
import { useSelectedAgentSessionItems } from '../src/hooks/useSelectedAgentSessionItems.ts';
import { useSessionRefreshActions } from '../src/hooks/useSessionRefreshActions.ts';
import type { HydrateImportedProjectFromAuthorityResult } from '../src/workbench/importedProjectHydration.ts';

const mocks = vi.hoisted(() => ({
  applyProjectSessionActivityRefresh: vi.fn((projects: readonly AgentProjectView[]) => projects),
  auth: {
    sessionRevision: 0,
    user: { email: 'user-a@example.com', id: 'user-a', name: 'User A' },
  },
  hydrateImportedProjectFromAuthority: vi.fn(),
  getAgentSessionTranscriptRevision: vi.fn(() => 0),
  loadEarlierAgentSessionItems: vi.fn(),
  mergeRefreshedAgentSessionIntoCurrent: vi.fn(
    (current: AgentProjectView['agentSessions'][number]) => current,
  ),
  mutateProjectsStoreByScopeKey: vi.fn(),
  peekProjectsStore: vi.fn(),
  refreshAgentSessionItems: vi.fn(),
  removeAgentSessionFromProjectsStore: vi.fn(() => 'removed'),
  synchronizeProjectSessions: vi.fn(),
  upsertAgentSessionIntoProjectsStore: vi.fn(),
  upsertAgentSessionIntoProjectsStoreIfTranscriptUnchanged: vi.fn(() => true),
  upsertProjectIntoProjectsStore: vi.fn(),
}));

vi.mock('../src/context/AuthContext.ts', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../src/stores/projectsStore.ts', () => ({
  buildProjectsStoreScopeKey: (userScope: string, workspaceId: string) =>
    `${userScope}\u0001${workspaceId}`,
  getAgentSessionTranscriptRevision: mocks.getAgentSessionTranscriptRevision,
  mutateProjectsStoreByScopeKey: mocks.mutateProjectsStoreByScopeKey,
  peekProjectsStore: mocks.peekProjectsStore,
  removeAgentSessionFromProjectsStore: mocks.removeAgentSessionFromProjectsStore,
  upsertAgentSessionIntoProjectsStore: mocks.upsertAgentSessionIntoProjectsStore,
  upsertAgentSessionIntoProjectsStoreIfTranscriptUnchanged:
    mocks.upsertAgentSessionIntoProjectsStoreIfTranscriptUnchanged,
  upsertProjectIntoProjectsStore: mocks.upsertProjectIntoProjectsStore,
}));

vi.mock('../src/workbench/importedProjectHydration.ts', () => ({
  hydrateImportedProjectFromAuthority: mocks.hydrateImportedProjectFromAuthority,
}));

vi.mock('../src/workbench/sessionRefresh.ts', () => ({
  applyProjectSessionActivityRefresh: mocks.applyProjectSessionActivityRefresh,
  buildAgentSessionItemsRefreshScopeKey: (scope: {
    agentId: string;
    agentSessionId: string;
    identityScope: string;
    projectId: string;
  }) => [
    scope.identityScope,
    scope.projectId,
    scope.agentId,
    scope.agentSessionId,
  ].join('\u0001'),
  loadEarlierAgentSessionItems: mocks.loadEarlierAgentSessionItems,
  mergeRefreshedAgentSessionIntoCurrent: mocks.mergeRefreshedAgentSessionIntoCurrent,
  refreshAgentSessionItems: mocks.refreshAgentSessionItems,
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function createProject(projectId: string, workspaceId = 'workspace-a'): AgentProjectView {
  return {
    agentSessions: [],
    createdAt: '2026-07-27T00:00:00.000Z',
    driveAccessMode: 'disabled',
    name: projectId,
    organizationId: 'organization-a',
    ownerUserId: 'user-a',
    projectId,
    status: 'active',
    tenantId: 'tenant-a',
    updatedAt: '2026-07-27T00:00:00.000Z',
    version: '1',
    visibility: 'private',
    workspaceId,
  };
}

function createSession(
  projectId: string,
  sessionId = 'session-a',
  agentId = 'agent.intelligence.codex',
): AgentProjectView['agentSessions'][number] {
  return {
    agentId,
    createdAt: '2026-07-27T00:00:00.000Z',
    displayTime: '00:00',
    engineId: 'codex',
    hostMode: 'web',
    id: sessionId,
    items: [],
    modelId: 'gpt-5',
    projectId,
    providerId: 'codex',
    runtimeStatus: 'ready',
    status: 'active',
    title: sessionId,
    updatedAt: '2026-07-27T00:00:00.000Z',
  } as AgentProjectView['agentSessions'][number];
}

function createImportedProjectResult(
  projectId = 'project-a',
  workspaceId = 'workspace-a',
): HydrateImportedProjectFromAuthorityResult {
  return {
    deletedSessionIds: [],
    deletedSessionTombstones: [],
    latestAgentSessionId: 'session-a',
    project: createProject(projectId, workspaceId),
  };
}

const listSessionsByProject = vi.fn<IAgentSessionService['listSessionsByProject']>()
  .mockResolvedValue({
    items: [],
    pageInfo: { hasMore: false, mode: 'offset', page: 1, pageSize: 200 },
  });
const agentSessionService = { listSessionsByProject } as unknown as IAgentSessionService;
const projectService = {} as IProjectService;
const refreshMessages = {
  failedToRefreshProjectSessions: 'Project refresh failed',
  failedToRefreshSessionMessages: 'Session refresh failed',
  projectSessionsRefreshed: (projectName: string) => `Refreshed ${projectName}`,
  sessionMessagesRefreshed: (sessionTitle: string) => `Refreshed ${sessionTitle}`,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.auth.sessionRevision = 0;
  mocks.auth.user = { email: 'user-a@example.com', id: 'user-a', name: 'User A' };
});

describe('useSessionRefreshActions request lifecycle', () => {
  it('uses the current selected Project when refreshing its Session without an explicit scope', async () => {
    const addToast = vi.fn();
    const project = createProject('project-a');
    const agentSession = createSession(project.projectId);
    const resolveAgentSessionLocation = vi.fn(() => ({ agentSession, project }));
    mocks.refreshAgentSessionItems.mockResolvedValueOnce({
      agentSessionId: agentSession.id,
      itemCount: 0,
      projectId: project.projectId,
      source: 'agents',
      status: 'refreshed',
    });
    const { result } = renderHook(() => useSessionRefreshActions({
      addToast,
      agentSessionService,
      getPreservedSelection: () => ({
        agentSessionId: agentSession.id,
        projectId: project.projectId,
      }),
      messages: refreshMessages,
      projectService,
      resolveAgentSessionLocation,
      resolveAgentSessionTitle: (sessionId) => sessionId,
      resolveProjectName: (projectId) => projectId,
      restoreSelectionAfterRefresh: vi.fn(),
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    await act(async () => {
      await result.current.handleRefreshAgentSessionItems(agentSession.id);
    });

    expect(resolveAgentSessionLocation).toHaveBeenCalledWith(
      agentSession.id,
      project.projectId,
    );
    expect(mocks.refreshAgentSessionItems).toHaveBeenCalledWith(expect.objectContaining({
      agentSessionId: agentSession.id,
      resolvedLocation: { agentSession, project },
    }));
    expect(addToast).toHaveBeenLastCalledWith(`Refreshed ${agentSession.id}`, 'success');
  });

  it('rejects an unscoped refresh for a Session outside the current selection', async () => {
    const addToast = vi.fn();
    const resolveAgentSessionLocation = vi.fn();
    const { result } = renderHook(() => useSessionRefreshActions({
      addToast,
      agentSessionService,
      getPreservedSelection: () => ({
        agentSessionId: 'session-a',
        projectId: 'project-a',
      }),
      messages: refreshMessages,
      projectService,
      resolveAgentSessionLocation,
      resolveAgentSessionTitle: (sessionId) => sessionId,
      resolveProjectName: (projectId) => projectId,
      restoreSelectionAfterRefresh: vi.fn(),
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    await act(async () => {
      await result.current.handleRefreshAgentSessionItems('session-b');
    });

    expect(resolveAgentSessionLocation).not.toHaveBeenCalled();
    expect(mocks.refreshAgentSessionItems).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledOnce();
    expect(addToast).toHaveBeenCalledWith('Session refresh failed', 'error');
  });

  it('clears an aborted history load before returning to the previous Session', async () => {
    const deferred = createDeferred<{
      agentSession: AgentProjectView['agentSessions'][number];
      loadedItemCount: number;
      projectId: string;
      source: 'agents';
      status: 'loaded';
    }>();
    const project = createProject('project-a');
    const agentSession = {
      ...createSession(project.projectId),
      itemPageInfo: { hasMore: true, page: 1, pageSize: 50 },
    } as AgentProjectView['agentSessions'][number];
    const props = {
      selection: { agentSessionId: agentSession.id, projectId: project.projectId },
    };
    mocks.loadEarlierAgentSessionItems.mockReturnValueOnce(deferred.promise);
    const { result, rerender } = renderHook(() => useSessionRefreshActions({
      addToast: vi.fn(),
      agentSessionService,
      getPreservedSelection: () => props.selection,
      messages: refreshMessages,
      projectService,
      resolveAgentSessionLocation: (sessionId, projectId) => (
        sessionId === agentSession.id && projectId === project.projectId
          ? { agentSession, project }
          : null
      ),
      resolveAgentSessionTitle: (sessionId) => sessionId,
      resolveProjectName: (projectId) => projectId,
      restoreSelectionAfterRefresh: vi.fn(),
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    let request!: Promise<void>;
    act(() => {
      request = result.current.handleLoadEarlierAgentSessionItems(
        agentSession.id,
        project.projectId,
      );
    });
    const requestSignal = mocks.loadEarlierAgentSessionItems.mock.calls[0]?.[0].signal;
    expect(result.current.loadingEarlierAgentSessionId).toBe(agentSession.id);
    expect(requestSignal.aborted).toBe(false);

    props.selection = { agentSessionId: 'session-b', projectId: project.projectId };
    rerender();
    expect(requestSignal.aborted).toBe(true);

    props.selection = { agentSessionId: agentSession.id, projectId: project.projectId };
    rerender();
    expect(result.current.loadingEarlierAgentSessionId).toBeNull();
    expect(result.current.loadingEarlierAgentSessionProjectId).toBeNull();

    await act(async () => {
      deferred.resolve({
        agentSession,
        loadedItemCount: 1,
        projectId: project.projectId,
        source: 'agents',
        status: 'loaded',
      });
      await request;
    });
    expect(mocks.upsertAgentSessionIntoProjectsStoreIfTranscriptUnchanged)
      .not.toHaveBeenCalled();
  });

  it('commits a history page only against its Agent, page, and transcript revision', async () => {
    const project = createProject('project-a');
    const agentSession = {
      ...createSession(project.projectId),
      itemPageInfo: { hasMore: true, page: 3, pageSize: 50 },
    };
    const loadedSession = {
      ...agentSession,
      itemPageInfo: { hasMore: false, page: 4, pageSize: 50 },
    };
    mocks.getAgentSessionTranscriptRevision.mockReturnValueOnce(17);
    mocks.loadEarlierAgentSessionItems.mockResolvedValueOnce({
      agentSession: loadedSession,
      loadedItemCount: 1,
      projectId: project.projectId,
      source: 'agents',
      status: 'loaded',
    });
    const { result } = renderHook(() => useSessionRefreshActions({
      addToast: vi.fn(),
      agentSessionService,
      getPreservedSelection: () => ({
        agentSessionId: agentSession.id,
        projectId: project.projectId,
      }),
      messages: refreshMessages,
      projectService,
      resolveAgentSessionLocation: () => ({ agentSession, project }),
      resolveAgentSessionTitle: (sessionId) => sessionId,
      resolveProjectName: (projectId) => projectId,
      restoreSelectionAfterRefresh: vi.fn(),
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    await act(async () => {
      await result.current.handleLoadEarlierAgentSessionItems(
        agentSession.id,
        project.projectId,
      );
    });

    expect(mocks.upsertAgentSessionIntoProjectsStoreIfTranscriptUnchanged)
      .toHaveBeenCalledWith(
        project.projectId,
        loadedSession,
        project.workspaceId,
        'user-a::session:0',
        {
          agentId: agentSession.agentId,
          hasMore: true,
          page: 3,
          pageSize: 50,
          revision: 17,
        },
        { itemMergeMode: 'ordered-window' },
      );
  });

  it('cancels a manual Session refresh when the selected Session changes', async () => {
    const deferred = createDeferred<{
      agentSessionId: string;
      itemCount: number;
      projectId: string;
      source: 'agents';
      status: 'failed';
    }>();
    const addToast = vi.fn();
    const restoreSelection = vi.fn();
    const project = createProject('project-a');
    const agentSession = {
      id: 'session-a',
      items: [],
      projectId: project.projectId,
      runtimeStatus: 'ready',
      status: 'active',
    } as unknown as AgentProjectView['agentSessions'][number];
    mocks.refreshAgentSessionItems.mockReturnValueOnce(deferred.promise);
    const props = {
      selection: { agentSessionId: 'session-a', projectId: 'project-a' },
    };
    const { result, rerender } = renderHook(() => useSessionRefreshActions({
      addToast,
      agentSessionService,
      getPreservedSelection: () => props.selection,
      messages: refreshMessages,
      projectService,
      resolveAgentSessionLocation: (sessionId, projectId) => (
        sessionId === agentSession.id && projectId === project.projectId
          ? { agentSession, project }
          : null
      ),
      resolveAgentSessionTitle: (sessionId) => sessionId,
      resolveProjectName: (projectId) => projectId,
      restoreSelectionAfterRefresh: restoreSelection,
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    let request!: Promise<void>;
    act(() => {
      request = result.current.handleRefreshAgentSessionItems('session-a', 'project-a');
    });
    const requestSignal = mocks.refreshAgentSessionItems.mock.calls[0]?.[0].signal;
    expect(requestSignal.aborted).toBe(false);

    props.selection = { agentSessionId: 'session-b', projectId: 'project-b' };
    rerender();
    expect(requestSignal.aborted).toBe(true);

    await act(async () => {
      deferred.resolve({
        agentSessionId: 'session-a',
        itemCount: 0,
        projectId: 'project-a',
        source: 'agents',
        status: 'failed',
      });
      await request;
    });

    expect(mocks.upsertAgentSessionIntoProjectsStore).not.toHaveBeenCalled();
    expect(restoreSelection).not.toHaveBeenCalled();
    expect(addToast).not.toHaveBeenCalled();
  });

  it('does not restore Session A after the live selection changes to Session B', async () => {
    const deferred = createDeferred<HydrateImportedProjectFromAuthorityResult | null>();
    const addToast = vi.fn();
    const restoreSelectionA = vi.fn();
    const restoreSelectionB = vi.fn();
    mocks.synchronizeProjectSessions.mockReturnValueOnce(deferred.promise);

    const { result, rerender } = renderHook((props: {
      restoreSelection: (projectId: string, sessionId: string | null) => void;
      selection: { agentSessionId: string | null; projectId: string };
    }) => useSessionRefreshActions({
      addToast,
      agentSessionService,
      getPreservedSelection: () => props.selection,
      messages: refreshMessages,
      projectService,
      resolveAgentSessionTitle: (sessionId) => sessionId,
      resolveProjectName: (projectId) => projectId,
      restoreSelectionAfterRefresh: props.restoreSelection,
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }), {
      initialProps: {
        restoreSelection: restoreSelectionA,
        selection: { agentSessionId: 'session-a', projectId: 'project-a' },
      },
    });

    let request!: Promise<void>;
    act(() => {
      request = result.current.handleRefreshProjectSessions('project-a');
    });
    expect(result.current.refreshingProjectId).toBe('project-a');

    rerender({
      restoreSelection: restoreSelectionB,
      selection: { agentSessionId: 'session-b', projectId: 'project-b' },
    });
    await act(async () => {
      deferred.resolve(createImportedProjectResult());
      await request;
    });

    expect(restoreSelectionA).not.toHaveBeenCalled();
    expect(restoreSelectionB).not.toHaveBeenCalled();
    expect(result.current.refreshingProjectId).toBeNull();
  });

  it('suppresses Store, callback, toast, and state commits after the auth scope changes', async () => {
    const deferred = createDeferred<HydrateImportedProjectFromAuthorityResult | null>();
    const addToast = vi.fn();
    const restoreSelection = vi.fn();
    mocks.synchronizeProjectSessions.mockReturnValueOnce(deferred.promise);
    const props = {
      selection: { agentSessionId: 'session-a', projectId: 'project-a' },
    };
    const { result, rerender } = renderHook(() => useSessionRefreshActions({
      addToast,
      agentSessionService,
      getPreservedSelection: () => props.selection,
      messages: refreshMessages,
      projectService,
      resolveAgentSessionTitle: (sessionId) => sessionId,
      resolveProjectName: (projectId) => projectId,
      restoreSelectionAfterRefresh: restoreSelection,
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    let request!: Promise<void>;
    const staleRefreshProjectSessions = result.current.handleRefreshProjectSessions;
    act(() => {
      request = staleRefreshProjectSessions('project-a');
    });
    mocks.auth.sessionRevision = 1;
    mocks.auth.user = { email: 'user-b@example.com', id: 'user-b', name: 'User B' };
    rerender();
    expect(result.current.refreshingProjectId).toBeNull();
    await expect(staleRefreshProjectSessions('project-a')).resolves.toBeUndefined();
    expect(mocks.synchronizeProjectSessions).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve(createImportedProjectResult());
      await request;
    });

    expect(mocks.mutateProjectsStoreByScopeKey).not.toHaveBeenCalled();
    expect(restoreSelection).not.toHaveBeenCalled();
    expect(addToast).not.toHaveBeenCalled();
    expect(result.current.refreshingProjectId).toBeNull();
  });

  it('suppresses completion after unmount even when the refresh source ignores cancellation', async () => {
    const deferred = createDeferred<HydrateImportedProjectFromAuthorityResult | null>();
    const addToast = vi.fn();
    const restoreSelection = vi.fn();
    mocks.synchronizeProjectSessions.mockReturnValueOnce(deferred.promise);
    const { result, unmount } = renderHook(() => useSessionRefreshActions({
      addToast,
      agentSessionService,
      getPreservedSelection: () => ({
        agentSessionId: 'session-a',
        projectId: 'project-a',
      }),
      messages: refreshMessages,
      projectService,
      resolveAgentSessionTitle: (sessionId) => sessionId,
      resolveProjectName: (projectId) => projectId,
      restoreSelectionAfterRefresh: restoreSelection,
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    let request!: Promise<void>;
    act(() => {
      request = result.current.handleRefreshProjectSessions('project-a');
    });
    unmount();
    deferred.resolve(createImportedProjectResult());
    await expect(request).resolves.toBeUndefined();

    expect(mocks.mutateProjectsStoreByScopeKey).not.toHaveBeenCalled();
    expect(restoreSelection).not.toHaveBeenCalled();
    expect(addToast).not.toHaveBeenCalled();
  });

  it('treats a superseded coordinated refresh as a neutral completion', async () => {
    const addToast = vi.fn();
    const restoreSelection = vi.fn();
    mocks.synchronizeProjectSessions.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useSessionRefreshActions({
      addToast,
      agentSessionService,
      getPreservedSelection: () => ({
        agentSessionId: 'session-a',
        projectId: 'project-a',
      }),
      messages: refreshMessages,
      projectService,
      resolveAgentSessionTitle: (sessionId) => sessionId,
      resolveProjectName: (projectId) => projectId,
      restoreSelectionAfterRefresh: restoreSelection,
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    await act(async () => {
      await result.current.handleRefreshProjectSessions('project-a');
    });

    expect(mocks.synchronizeProjectSessions).toHaveBeenCalledWith('project-a', true);
    expect(addToast).not.toHaveBeenCalled();
    expect(restoreSelection).not.toHaveBeenCalled();
    expect(result.current.refreshingProjectId).toBeNull();
  });

  it('surfaces a genuine coordinated refresh failure once', async () => {
    const addToast = vi.fn();
    const restoreSelection = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const refreshError = new Error('Agents unavailable');
    mocks.synchronizeProjectSessions.mockRejectedValueOnce(refreshError);
    const { result } = renderHook(() => useSessionRefreshActions({
      addToast,
      agentSessionService,
      getPreservedSelection: () => ({
        agentSessionId: 'session-a',
        projectId: 'project-a',
      }),
      messages: refreshMessages,
      projectService,
      resolveAgentSessionTitle: (sessionId) => sessionId,
      resolveProjectName: (projectId) => projectId,
      restoreSelectionAfterRefresh: restoreSelection,
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    await act(async () => {
      await result.current.handleRefreshProjectSessions('project-a');
    });

    expect(addToast).toHaveBeenCalledTimes(1);
    expect(addToast).toHaveBeenCalledWith(refreshMessages.failedToRefreshProjectSessions, 'error');
    expect(restoreSelection).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith('Failed to refresh project sessions', refreshError);
    consoleError.mockRestore();
  });
});

describe('useSelectedAgentSessionItems background refresh', () => {
  it('reports a failed initial transcript load to the owning surface', async () => {
    const selectedProject = createProject('project-a');
    const selectedAgentSession = createSession(selectedProject.projectId);
    const onAgentSessionItemsLoadFailed = vi.fn();
    mocks.refreshAgentSessionItems.mockResolvedValueOnce({
      agentSessionId: selectedAgentSession.id,
      itemCount: 0,
      projectId: selectedProject.projectId,
      source: 'agents',
      status: 'failed',
    });

    const { result } = renderHook(() => useSelectedAgentSessionItems({
      agentSessionService,
      onAgentSessionItemsLoadFailed,
      projectService,
      selectedAgentSession,
      selectedAgentSessionId: selectedAgentSession.id,
      selectedProject,
      selectionRefreshToken: 0,
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    await waitFor(() => expect(result.current).toBe(false));
    expect(onAgentSessionItemsLoadFailed).toHaveBeenCalledOnce();
    expect(onAgentSessionItemsLoadFailed).toHaveBeenCalledWith(selectedAgentSession.id);
  });

  it('isolates a throwing load-failed observer from the transcript request lifecycle', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const selectedProject = createProject('project-a');
    const selectedAgentSession = createSession(selectedProject.projectId);
    const observerError = new Error('surface observer failed');
    const onAgentSessionItemsLoadFailed = vi.fn(() => {
      throw observerError;
    });
    mocks.refreshAgentSessionItems.mockResolvedValueOnce({
      agentSessionId: selectedAgentSession.id,
      itemCount: 0,
      projectId: selectedProject.projectId,
      source: 'agents',
      status: 'failed',
    });

    const { result } = renderHook(() => useSelectedAgentSessionItems({
      agentSessionService,
      onAgentSessionItemsLoadFailed,
      projectService,
      selectedAgentSession,
      selectedAgentSessionId: selectedAgentSession.id,
      selectedProject,
      selectionRefreshToken: 0,
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    await waitFor(() => expect(result.current).toBe(false));
    expect(onAgentSessionItemsLoadFailed).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith(
      'Agents session items load-failed observer failed',
      observerError,
    );
    expect(consoleError).not.toHaveBeenCalledWith(
      'Failed to load Agents session items',
      observerError,
    );
    consoleError.mockRestore();
  });

  it('reports initial hydration during the first render before effects run', () => {
    const selectedProject = createProject('project-a');
    const selectedAgentSession = {
      id: 'session-a',
      items: [],
      projectId: selectedProject.projectId,
      runtimeStatus: 'ready',
      status: 'active',
    } as unknown as AgentProjectView['agentSessions'][number];

    function InitialLoadingProbe() {
      const isLoading = useSelectedAgentSessionItems({
        agentSessionService,
        projectService,
        selectedAgentSession,
        selectedAgentSessionId: selectedAgentSession.id,
        selectedProject,
        selectionRefreshToken: 0,
        synchronizeProjectSessions: mocks.synchronizeProjectSessions,
      });
      return <span>{isLoading ? 'loading' : 'idle'}</span>;
    }

    expect(renderToString(<InitialLoadingProbe />)).toContain('loading');
    expect(mocks.refreshAgentSessionItems).not.toHaveBeenCalled();
  });

  it('does not supersede an active refresh on poll, focus, visibility, or online events', async () => {
    vi.useFakeTimers();
    try {
      const deferred = createDeferred<{
        agentSessionId: string;
        itemCount: number;
        projectId: string;
        source: 'agents';
        status: 'failed';
      }>();
      mocks.refreshAgentSessionItems.mockReturnValueOnce(deferred.promise);
      const selectedProject = createProject('project-a');
      const selectedAgentSession = {
        id: 'session-a',
        items: [],
        projectId: selectedProject.projectId,
        runtimeStatus: 'ready',
        status: 'active',
      } as unknown as AgentProjectView['agentSessions'][number];

      const { result } = renderHook(() => useSelectedAgentSessionItems({
        agentSessionService,
        projectService,
        selectedAgentSession,
        selectedAgentSessionId: selectedAgentSession.id,
        selectedProject,
        selectionRefreshToken: 0,
        synchronizeProjectSessions: mocks.synchronizeProjectSessions,
      }));

      expect(result.current).toBe(true);
      expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(1);
      const requestSignal = mocks.refreshAgentSessionItems.mock.calls[0]?.[0].signal;
      expect(requestSignal.aborted).toBe(false);

      act(() => {
        vi.advanceTimersByTime(60_000);
        window.dispatchEvent(new Event('focus'));
        window.dispatchEvent(new Event('online'));
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(1);
      expect(requestSignal.aborted).toBe(false);

      await act(async () => {
        deferred.resolve({
          agentSessionId: selectedAgentSession.id,
          itemCount: 0,
          projectId: selectedProject.projectId,
          source: 'agents',
          status: 'failed',
        });
        await deferred.promise;
      });
      expect(result.current).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps an empty transcript stable while a completed Session refreshes in the background', async () => {
    const backgroundRefresh = createDeferred<{
      agentSessionId: string;
      itemCount: number;
      projectId: string;
      source: 'agents';
      status: 'failed';
    }>();
    const selectedProject = createProject('project-a');
    const selectedAgentSession = createSession(selectedProject.projectId);
    const failedResult = {
      agentSessionId: selectedAgentSession.id,
      itemCount: 0,
      projectId: selectedProject.projectId,
      source: 'agents' as const,
      status: 'failed' as const,
    };
    mocks.refreshAgentSessionItems
      .mockResolvedValueOnce(failedResult)
      .mockReturnValueOnce(backgroundRefresh.promise);

    const { result } = renderHook(() => useSelectedAgentSessionItems({
      agentSessionService,
      projectService,
      selectedAgentSession,
      selectedAgentSessionId: selectedAgentSession.id,
      selectedProject,
      selectionRefreshToken: 0,
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    expect(result.current).toBe(true);
    await waitFor(() => expect(result.current).toBe(false));
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(2));
    expect(result.current).toBe(false);

    await act(async () => {
      backgroundRefresh.resolve(failedResult);
      await backgroundRefresh.promise;
    });
    expect(result.current).toBe(false);
  });

  it('reports foreground loading while an explicit transcript retry is pending', async () => {
    const retry = createDeferred<{
      agentSessionId: string;
      itemCount: number;
      projectId: string;
      source: 'agents';
      status: 'failed';
    }>();
    const selectedProject = createProject('project-a');
    const selectedAgentSession = createSession(selectedProject.projectId);
    const failedResult = {
      agentSessionId: selectedAgentSession.id,
      itemCount: 0,
      projectId: selectedProject.projectId,
      source: 'agents' as const,
      status: 'failed' as const,
    };
    mocks.refreshAgentSessionItems
      .mockResolvedValueOnce(failedResult)
      .mockReturnValueOnce(retry.promise);

    const { result, rerender } = renderHook(
      ({ selectionRefreshToken }: { selectionRefreshToken: number }) =>
        useSelectedAgentSessionItems({
          agentSessionService,
          projectService,
          selectedAgentSession,
          selectedAgentSessionId: selectedAgentSession.id,
          selectedProject,
          selectionRefreshToken,
          synchronizeProjectSessions: mocks.synchronizeProjectSessions,
        }),
      { initialProps: { selectionRefreshToken: 0 } },
    );

    await waitFor(() => expect(result.current).toBe(false));
    rerender({ selectionRefreshToken: 1 });

    expect(result.current).toBe(true);
    await waitFor(() => expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(2));
    expect(result.current).toBe(true);

    await act(async () => {
      retry.resolve(failedResult);
      await retry.promise;
    });
    expect(result.current).toBe(false);
  });

  it('treats a return to a previously failed Session as a new foreground load', async () => {
    const secondSessionRefresh = createDeferred<{
      agentSessionId: string;
      itemCount: number;
      projectId: string;
      source: 'agents';
      status: 'failed';
    }>();
    const returnedSessionRefresh = createDeferred<{
      agentSessionId: string;
      itemCount: number;
      projectId: string;
      source: 'agents';
      status: 'failed';
    }>();
    const selectedProject = createProject('project-a');
    const firstSession = createSession(selectedProject.projectId, 'session-a');
    const secondSession = createSession(selectedProject.projectId, 'session-b');
    const firstFailure = {
      agentSessionId: firstSession.id,
      itemCount: 0,
      projectId: selectedProject.projectId,
      source: 'agents' as const,
      status: 'failed' as const,
    };
    mocks.refreshAgentSessionItems
      .mockResolvedValueOnce(firstFailure)
      .mockReturnValueOnce(secondSessionRefresh.promise)
      .mockReturnValueOnce(returnedSessionRefresh.promise);

    const { result, rerender } = renderHook(
      ({ selectedAgentSession }: {
        selectedAgentSession: AgentProjectView['agentSessions'][number];
      }) => useSelectedAgentSessionItems({
        agentSessionService,
        projectService,
        selectedAgentSession,
        selectedAgentSessionId: selectedAgentSession.id,
        selectedProject,
        selectionRefreshToken: 0,
        synchronizeProjectSessions: mocks.synchronizeProjectSessions,
      }),
      { initialProps: { selectedAgentSession: firstSession } },
    );

    await waitFor(() => expect(result.current).toBe(false));
    rerender({ selectedAgentSession: secondSession });
    await waitFor(() => expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(2));
    rerender({ selectedAgentSession: firstSession });

    await waitFor(() => expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(3));
    expect(result.current).toBe(true);
    expect(mocks.refreshAgentSessionItems.mock.calls[1]?.[0].signal.aborted).toBe(true);

    await act(async () => {
      returnedSessionRefresh.resolve(firstFailure);
      await returnedSessionRefresh.promise;
    });
    expect(result.current).toBe(false);
  });

  it('refreshes immediately when the selected Session Agent identity changes and ignores the old request', async () => {
    const firstRefresh = createDeferred<{
      agentSession: AgentProjectView['agentSessions'][number];
      agentSessionId: string;
      itemCount: number;
      projectId: string;
      source: 'agents';
      status: 'refreshed';
    }>();
    const selectedProject = createProject('project-a');
    const firstSession = createSession(
      selectedProject.projectId,
      'session-a',
      'agent.intelligence.stale',
    );
    const correctedSession = {
      ...firstSession,
      agentId: 'agent.intelligence.codex',
    };
    const failedResult = {
      agentSessionId: firstSession.id,
      itemCount: 0,
      projectId: selectedProject.projectId,
      source: 'agents' as const,
      status: 'failed' as const,
    };
    mocks.refreshAgentSessionItems
      .mockReturnValueOnce(firstRefresh.promise)
      .mockResolvedValueOnce(failedResult);

    const { rerender } = renderHook(
      ({ selectedAgentSession }: { selectedAgentSession: AgentProjectView['agentSessions'][number] }) =>
        useSelectedAgentSessionItems({
          agentSessionService,
          projectService,
          selectedAgentSession,
          selectedAgentSessionId: selectedAgentSession.id,
          selectedProject,
          selectionRefreshToken: 0,
          synchronizeProjectSessions: mocks.synchronizeProjectSessions,
        }),
      { initialProps: { selectedAgentSession: firstSession } },
    );

    await waitFor(() => expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(1));
    const firstSignal = mocks.refreshAgentSessionItems.mock.calls[0]?.[0].signal;
    rerender({ selectedAgentSession: correctedSession });
    await waitFor(() => expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(2));
    expect(firstSignal.aborted).toBe(true);
    expect(mocks.refreshAgentSessionItems.mock.calls[1]?.[0].resolvedLocation?.agentSession.agentId)
      .toBe('agent.intelligence.codex');

    await act(async () => {
      firstRefresh.resolve({
        agentSession: firstSession,
        agentSessionId: firstSession.id,
        itemCount: 0,
        projectId: selectedProject.projectId,
        source: 'agents',
        status: 'refreshed',
      });
      await firstRefresh.promise;
    });
    expect(mocks.upsertAgentSessionIntoProjectsStore).not.toHaveBeenCalled();
  });

  it('cancels a stale transcript request when the selected Session changes rapidly', async () => {
    const firstRefresh = createDeferred<{
      agentSessionId: string;
      itemCount: number;
      projectId: string;
      source: 'agents';
      status: 'failed';
    }>();
    const selectedProject = createProject('project-a');
    const firstSession = createSession(selectedProject.projectId, 'session-a');
    const secondSession = createSession(selectedProject.projectId, 'session-b');
    mocks.refreshAgentSessionItems
      .mockReturnValueOnce(firstRefresh.promise)
      .mockResolvedValueOnce({
        agentSessionId: secondSession.id,
        itemCount: 0,
        projectId: selectedProject.projectId,
        source: 'agents',
        status: 'failed',
      });

    const { rerender } = renderHook(
      ({ selectedAgentSession }: { selectedAgentSession: AgentProjectView['agentSessions'][number] }) =>
        useSelectedAgentSessionItems({
          agentSessionService,
          projectService,
          selectedAgentSession,
          selectedAgentSessionId: selectedAgentSession.id,
          selectedProject,
          selectionRefreshToken: 0,
          synchronizeProjectSessions: mocks.synchronizeProjectSessions,
        }),
      { initialProps: { selectedAgentSession: firstSession } },
    );
    const firstSignal = mocks.refreshAgentSessionItems.mock.calls[0]?.[0].signal;

    rerender({ selectedAgentSession: secondSession });

    await waitFor(() => expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(2));
    expect(firstSignal.aborted).toBe(true);
    expect(mocks.refreshAgentSessionItems.mock.calls[1]?.[0].agentSessionId)
      .toBe(secondSession.id);

    await act(async () => {
      firstRefresh.resolve({
        agentSessionId: firstSession.id,
        itemCount: 0,
        projectId: selectedProject.projectId,
        source: 'agents',
        status: 'failed',
      });
      await firstRefresh.promise;
    });
    expect(mocks.upsertAgentSessionIntoProjectsStore).not.toHaveBeenCalled();
  });

  it('ignores a late inventory recovery after the selected project changes', async () => {
    const inventoryRecovery = createDeferred<HydrateImportedProjectFromAuthorityResult | null>();
    const firstProject = {
      ...createProject('project-a'),
      agentSessions: [createSession('project-a', 'session-a')],
    };
    const secondProject = {
      ...createProject('project-b'),
      agentSessions: [createSession('project-b', 'session-b')],
    };
    const onAgentSessionUnavailable = vi.fn();
    mocks.refreshAgentSessionItems
      .mockResolvedValueOnce({
        agentSessionId: 'session-a',
        itemCount: 0,
        projectId: 'project-a',
        source: 'agents',
        status: 'not-found',
      })
      .mockResolvedValueOnce({
        agentSessionId: 'session-b',
        itemCount: 0,
        projectId: 'project-b',
        source: 'agents',
        status: 'failed',
      });
    mocks.synchronizeProjectSessions.mockReturnValueOnce(inventoryRecovery.promise);

    const { rerender } = renderHook(
      ({ selectedProject }: { selectedProject: AgentProjectView }) => {
        const selectedAgentSession = selectedProject.agentSessions[0]!;
        return useSelectedAgentSessionItems({
          agentSessionService,
          onAgentSessionUnavailable,
          projectService,
          selectedAgentSession,
          selectedAgentSessionId: selectedAgentSession.id,
          selectedProject,
          selectionRefreshToken: 0,
          synchronizeProjectSessions: mocks.synchronizeProjectSessions,
        });
      },
      { initialProps: { selectedProject: firstProject } },
    );

    await waitFor(() => expect(mocks.synchronizeProjectSessions).toHaveBeenCalledTimes(1));
    rerender({ selectedProject: secondProject });
    await waitFor(() => expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(2));

    await act(async () => {
      inventoryRecovery.resolve({
        ...createImportedProjectResult('project-a'),
        project: firstProject,
      });
      await inventoryRecovery.promise;
    });
    expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(2);
    expect(mocks.removeAgentSessionFromProjectsStore).not.toHaveBeenCalled();
    expect(onAgentSessionUnavailable).not.toHaveBeenCalled();
  });

  it('does not restart item loading when the project synchronization callback changes', async () => {
    const deferred = createDeferred<{
      agentSessionId: string;
      itemCount: number;
      projectId: string;
      source: 'agents';
      status: 'failed';
    }>();
    mocks.refreshAgentSessionItems.mockReturnValueOnce(deferred.promise);
    const selectedProject = createProject('project-a');
    const selectedAgentSession = createSession(selectedProject.projectId);
    const synchronizeA = vi.fn();
    const synchronizeB = vi.fn();

    const { result, rerender } = renderHook((props: {
      synchronizeProjectSessions: typeof synchronizeA;
    }) => useSelectedAgentSessionItems({
      agentSessionService,
      projectService,
      selectedAgentSession,
      selectedAgentSessionId: selectedAgentSession.id,
      selectedProject,
      selectionRefreshToken: 0,
      synchronizeProjectSessions: props.synchronizeProjectSessions,
    }), {
      initialProps: { synchronizeProjectSessions: synchronizeA },
    });
    const requestSignal = mocks.refreshAgentSessionItems.mock.calls[0]?.[0].signal;

    rerender({ synchronizeProjectSessions: synchronizeB });

    expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(1);
    expect(requestSignal.aborted).toBe(false);
    await act(async () => {
      deferred.resolve({
        agentSessionId: selectedAgentSession.id,
        itemCount: 0,
        projectId: selectedProject.projectId,
        source: 'agents',
        status: 'failed',
      });
      await deferred.promise;
    });
    expect(result.current).toBe(false);
    expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(1);
  });

  it('uses the latest unavailable callback without restarting recovery', async () => {
    const inventoryRecovery = createDeferred<HydrateImportedProjectFromAuthorityResult | null>();
    const selectedAgentSession = createSession('project-a');
    const selectedProject = {
      ...createProject('project-a'),
      agentSessions: [selectedAgentSession],
    };
    const onUnavailableA = vi.fn();
    const onUnavailableB = vi.fn();
    mocks.refreshAgentSessionItems.mockResolvedValueOnce({
      agentSessionId: selectedAgentSession.id,
      itemCount: 0,
      projectId: selectedProject.projectId,
      source: 'agents',
      status: 'not-found',
    });
    mocks.synchronizeProjectSessions.mockReturnValueOnce(inventoryRecovery.promise);

    const { rerender } = renderHook(
      ({ onAgentSessionUnavailable }: {
        onAgentSessionUnavailable: (agentSessionId: string, projectId: string) => void;
      }) => useSelectedAgentSessionItems({
        agentSessionService,
        onAgentSessionUnavailable,
        projectService,
        selectedAgentSession,
        selectedAgentSessionId: selectedAgentSession.id,
        selectedProject,
        selectionRefreshToken: 0,
        synchronizeProjectSessions: mocks.synchronizeProjectSessions,
      }),
      { initialProps: { onAgentSessionUnavailable: onUnavailableA } },
    );

    await waitFor(() => expect(mocks.synchronizeProjectSessions).toHaveBeenCalledTimes(1));
    const requestSignal = mocks.refreshAgentSessionItems.mock.calls[0]?.[0].signal;
    rerender({ onAgentSessionUnavailable: onUnavailableB });

    expect(requestSignal.aborted).toBe(false);
    expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(1);

    await act(async () => {
      inventoryRecovery.resolve({
        ...createImportedProjectResult(),
        deletedSessionIds: [selectedAgentSession.id],
      });
      await inventoryRecovery.promise;
    });
    expect(onUnavailableA).not.toHaveBeenCalled();
    expect(onUnavailableB).toHaveBeenCalledOnce();
    expect(onUnavailableB).toHaveBeenCalledWith(
      selectedAgentSession.id,
      selectedProject.projectId,
    );
    expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(1);
  });

  it('cancels the active refresh and clears loading when the selected surface is deactivated', async () => {
    const deferred = createDeferred<{
      agentSessionId: string;
      itemCount: number;
      projectId: string;
      source: 'agents';
      status: 'failed';
    }>();
    mocks.refreshAgentSessionItems.mockReturnValueOnce(deferred.promise);
    const selectedProject = createProject('project-a');
    const selectedAgentSession = {
      id: 'session-a',
      items: [],
      projectId: selectedProject.projectId,
      runtimeStatus: 'ready',
      status: 'active',
    } as unknown as AgentProjectView['agentSessions'][number];

    const { result, rerender } = renderHook(
      ({ isActive }: { isActive: boolean }) => useSelectedAgentSessionItems({
        agentSessionService,
        isActive,
        projectService,
        selectedAgentSession,
        selectedAgentSessionId: selectedAgentSession.id,
        selectedProject,
        selectionRefreshToken: 0,
        synchronizeProjectSessions: mocks.synchronizeProjectSessions,
      }),
      { initialProps: { isActive: true } },
    );

    expect(result.current).toBe(true);
    const requestSignal = mocks.refreshAgentSessionItems.mock.calls[0]?.[0].signal;

    rerender({ isActive: false });

    expect(requestSignal.aborted).toBe(true);
    expect(result.current).toBe(false);

    await act(async () => {
      deferred.resolve({
        agentSessionId: selectedAgentSession.id,
        itemCount: 0,
        projectId: selectedProject.projectId,
        source: 'agents',
        status: 'failed',
      });
      await deferred.promise;
    });
    expect(result.current).toBe(false);
  });

  it('refreshes provider inventory and retries items once when a canonical Session reappears', async () => {
    const selectedAgentSession = createSession('project-a');
    const selectedProject = {
      ...createProject('project-a'),
      agentSessions: [selectedAgentSession],
    };
    const synchronizedProject = {
      ...selectedProject,
      agentSessions: [{ ...selectedAgentSession, title: 'Recovered' }],
    };
    const synchronized = {
      ...createImportedProjectResult(),
      project: synchronizedProject,
    };
    mocks.refreshAgentSessionItems
      .mockResolvedValueOnce({
        agentSessionId: selectedAgentSession.id,
        itemCount: 0,
        projectId: selectedProject.projectId,
        source: 'agents',
        status: 'not-found',
      })
      .mockResolvedValueOnce({
        agentSession: synchronizedProject.agentSessions[0],
        agentSessionId: selectedAgentSession.id,
        itemCount: 0,
        projectId: selectedProject.projectId,
        source: 'agents',
        status: 'refreshed',
      });
    mocks.synchronizeProjectSessions.mockResolvedValueOnce(synchronized);
    const onAgentSessionUnavailable = vi.fn();

    const { result } = renderHook(() => useSelectedAgentSessionItems({
      agentSessionService,
      onAgentSessionUnavailable,
      projectService,
      selectedAgentSession,
      selectedAgentSessionId: selectedAgentSession.id,
      selectedProject,
      selectionRefreshToken: 0,
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    await waitFor(() => expect(result.current).toBe(false));
    expect(mocks.synchronizeProjectSessions).toHaveBeenCalledWith('project-a', true);
    expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(2);
    expect(mocks.refreshAgentSessionItems.mock.calls[1]?.[0].resolvedLocation)
      .toEqual({
        agentSession: synchronizedProject.agentSessions[0],
        project: synchronizedProject,
      });
    expect(mocks.removeAgentSessionFromProjectsStore).not.toHaveBeenCalled();
    expect(onAgentSessionUnavailable).not.toHaveBeenCalled();
  });

  it('retries with the authoritative Agent identity when inventory corrects a stale projection', async () => {
    const selectedAgentSession = createSession(
      'project-a',
      'session-a',
      'agent.intelligence.stale',
    );
    const correctedSession = {
      ...selectedAgentSession,
      agentId: 'agent.intelligence.codex',
    };
    const selectedProject = {
      ...createProject('project-a'),
      agentSessions: [selectedAgentSession],
    };
    const synchronizedProject = {
      ...selectedProject,
      agentSessions: [correctedSession],
    };
    mocks.refreshAgentSessionItems
      .mockResolvedValueOnce({
        agentSessionId: selectedAgentSession.id,
        itemCount: 0,
        projectId: selectedProject.projectId,
        source: 'agents',
        status: 'not-found',
      })
      .mockResolvedValueOnce({
        agentSession: correctedSession,
        agentSessionId: correctedSession.id,
        itemCount: 0,
        projectId: synchronizedProject.projectId,
        source: 'agents',
        status: 'refreshed',
      });
    mocks.synchronizeProjectSessions.mockResolvedValueOnce({
      ...createImportedProjectResult(),
      project: synchronizedProject,
    });

    const { result } = renderHook(() => useSelectedAgentSessionItems({
      agentSessionService,
      projectService,
      selectedAgentSession,
      selectedAgentSessionId: selectedAgentSession.id,
      selectedProject,
      selectionRefreshToken: 0,
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    await waitFor(() => expect(result.current).toBe(false));
    expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(2);
    expect(mocks.refreshAgentSessionItems.mock.calls[1]?.[0].resolvedLocation)
      .toEqual({
        agentSession: correctedSession,
        project: synchronizedProject,
      });
    expect(mocks.removeAgentSessionFromProjectsStore).not.toHaveBeenCalled();
  });

  it('clears a stale selection when the complete project inventory cannot resolve it', async () => {
    const selectedAgentSession = createSession(
      'project-a',
      'session-a',
      'agent.intelligence.stale',
    );
    const selectedProject = {
      ...createProject('project-a'),
      agentSessions: [selectedAgentSession],
    };
    mocks.refreshAgentSessionItems.mockResolvedValueOnce({
      agentSessionId: selectedAgentSession.id,
      itemCount: 0,
      projectId: selectedProject.projectId,
      source: 'agents',
      status: 'not-found',
    });
    mocks.synchronizeProjectSessions.mockResolvedValueOnce({
      ...createImportedProjectResult(),
      project: createProject('project-a'),
    });
    const onAgentSessionUnavailable = vi.fn();
    const onAgentSessionItemsLoadFailed = vi.fn();

    const { result } = renderHook(() => useSelectedAgentSessionItems({
      agentSessionService,
      onAgentSessionItemsLoadFailed,
      onAgentSessionUnavailable,
      projectService,
      selectedAgentSession,
      selectedAgentSessionId: selectedAgentSession.id,
      selectedProject,
      selectionRefreshToken: 0,
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    await waitFor(() => expect(result.current).toBe(false));
    expect(mocks.synchronizeProjectSessions).toHaveBeenCalledTimes(1);
    expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(1);
    expect(mocks.removeAgentSessionFromProjectsStore).toHaveBeenCalledWith(
      'user-a::session:0\u0001workspace-a',
      'project-a',
      'session-a',
      'agent.intelligence.stale',
    );
    expect(onAgentSessionUnavailable).toHaveBeenCalledOnce();
    expect(onAgentSessionUnavailable).toHaveBeenCalledWith('session-a', 'project-a');
    expect(onAgentSessionItemsLoadFailed).not.toHaveBeenCalled();
  });

  it('clears a stale selection when authoritative inventory returns its tombstone', async () => {
    const selectedAgentSession = createSession('project-a');
    const selectedProject = {
      ...createProject('project-a'),
      agentSessions: [selectedAgentSession],
    };
    mocks.refreshAgentSessionItems.mockResolvedValueOnce({
      agentSessionId: selectedAgentSession.id,
      itemCount: 0,
      projectId: selectedProject.projectId,
      source: 'agents',
      status: 'not-found',
    });
    mocks.synchronizeProjectSessions.mockResolvedValueOnce({
      ...createImportedProjectResult(),
      deletedSessionIds: [selectedAgentSession.id],
    });
    const onAgentSessionUnavailable = vi.fn();

    const { result } = renderHook(() => useSelectedAgentSessionItems({
      agentSessionService,
      onAgentSessionUnavailable,
      projectService,
      selectedAgentSession,
      selectedAgentSessionId: selectedAgentSession.id,
      selectedProject,
      selectionRefreshToken: 0,
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    await waitFor(() => expect(result.current).toBe(false));
    expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(1);
    expect(mocks.removeAgentSessionFromProjectsStore).toHaveBeenCalledWith(
      'user-a::session:0\u0001workspace-a',
      'project-a',
      'session-a',
      'agent.intelligence.codex',
    );
    expect(onAgentSessionUnavailable).toHaveBeenCalledWith('session-a', 'project-a');
  });

  it('does not clear a newer Agent selection when an older identity confirms a 404', async () => {
    const selectedAgentSession = createSession(
      'project-a',
      'session-a',
      'agent.intelligence.stale',
    );
    const selectedProject = {
      ...createProject('project-a'),
      agentSessions: [selectedAgentSession],
    };
    mocks.refreshAgentSessionItems.mockResolvedValueOnce({
      agentSessionId: selectedAgentSession.id,
      itemCount: 0,
      projectId: selectedProject.projectId,
      source: 'agents',
      status: 'not-found',
    });
    mocks.synchronizeProjectSessions.mockResolvedValueOnce({
      ...createImportedProjectResult(),
      deletedSessionIds: [selectedAgentSession.id],
    });
    mocks.removeAgentSessionFromProjectsStore.mockReturnValueOnce('identity-mismatch');
    const onAgentSessionUnavailable = vi.fn();

    const { result } = renderHook(() => useSelectedAgentSessionItems({
      agentSessionService,
      onAgentSessionUnavailable,
      projectService,
      selectedAgentSession,
      selectedAgentSessionId: selectedAgentSession.id,
      selectedProject,
      selectionRefreshToken: 0,
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    await waitFor(() => expect(result.current).toBe(false));
    expect(mocks.removeAgentSessionFromProjectsStore).toHaveBeenCalledWith(
      'user-a::session:0\u0001workspace-a',
      'project-a',
      'session-a',
      'agent.intelligence.stale',
    );
    expect(onAgentSessionUnavailable).not.toHaveBeenCalled();
  });

  it('preserves the selection when authoritative inventory refresh fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const selectedAgentSession = createSession('project-a');
    const selectedProject = {
      ...createProject('project-a'),
      agentSessions: [selectedAgentSession],
    };
    const inventoryError = new Error('inventory unavailable');
    mocks.refreshAgentSessionItems.mockResolvedValueOnce({
      agentSessionId: selectedAgentSession.id,
      itemCount: 0,
      projectId: selectedProject.projectId,
      source: 'agents',
      status: 'not-found',
    });
    mocks.synchronizeProjectSessions.mockRejectedValueOnce(inventoryError);
    const onAgentSessionUnavailable = vi.fn();

    const { result } = renderHook(() => useSelectedAgentSessionItems({
      agentSessionService,
      onAgentSessionUnavailable,
      projectService,
      selectedAgentSession,
      selectedAgentSessionId: selectedAgentSession.id,
      selectedProject,
      selectionRefreshToken: 0,
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    await waitFor(() => expect(result.current).toBe(false));
    expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(1);
    expect(mocks.removeAgentSessionFromProjectsStore).not.toHaveBeenCalled();
    expect(onAgentSessionUnavailable).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to recover Agents session inventory',
      inventoryError,
    );
    consoleError.mockRestore();
  });

  it('clears the selection after the single exact post-inventory retry confirms a 404', async () => {
    const selectedAgentSession = createSession('project-a');
    const selectedProject = {
      ...createProject('project-a'),
      agentSessions: [selectedAgentSession],
    };
    const synchronizedProject = {
      ...selectedProject,
      agentSessions: [{ ...selectedAgentSession }],
    };
    mocks.refreshAgentSessionItems
      .mockResolvedValueOnce({
        agentSessionId: selectedAgentSession.id,
        itemCount: 0,
        projectId: selectedProject.projectId,
        source: 'agents',
        status: 'not-found',
      })
      .mockResolvedValueOnce({
        agentSessionId: selectedAgentSession.id,
        itemCount: 0,
        projectId: selectedProject.projectId,
        source: 'agents',
        status: 'not-found',
      });
    mocks.synchronizeProjectSessions.mockResolvedValueOnce({
      ...createImportedProjectResult(),
      project: synchronizedProject,
    });
    const onAgentSessionUnavailable = vi.fn();

    const { result } = renderHook(() => useSelectedAgentSessionItems({
      agentSessionService,
      onAgentSessionUnavailable,
      projectService,
      selectedAgentSession,
      selectedAgentSessionId: selectedAgentSession.id,
      selectedProject,
      selectionRefreshToken: 0,
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    await waitFor(() => expect(result.current).toBe(false));
    expect(mocks.synchronizeProjectSessions).toHaveBeenCalledTimes(1);
    expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(2);
    expect(mocks.removeAgentSessionFromProjectsStore).toHaveBeenCalledWith(
      'user-a::session:0\u0001workspace-a',
      'project-a',
      'session-a',
      'agent.intelligence.codex',
    );
    expect(onAgentSessionUnavailable).toHaveBeenCalledWith('session-a', 'project-a');
  });

  it('recovers an old Session identity beyond the bounded activity head', async () => {
    const selectedProject = createProject('project-a');
    const recoveredSession = createSession(
      selectedProject.projectId,
      'session.outside-head',
      'agent.intelligence.codex',
    );
    const sessionRecord = {
      agentId: recoveredSession.agentId,
      createdAt: recoveredSession.createdAt,
      lastItemAt: null,
      lastItemSequence: '0',
      projectId: selectedProject.projectId,
      sessionId: recoveredSession.id,
      status: 'active',
      title: recoveredSession.title,
      updatedAt: recoveredSession.updatedAt,
      version: '1',
    } as Awaited<ReturnType<IAgentSessionService['getSession']>>;
    const otherSessionRecord = {
      ...sessionRecord,
      sessionId: 'session.other',
    };
    mocks.refreshAgentSessionItems
      .mockResolvedValueOnce({
        agentSessionId: recoveredSession.id,
        itemCount: 0,
        projectId: selectedProject.projectId,
        source: 'agents',
        status: 'not-found',
      })
      .mockResolvedValueOnce({
        agentSession: recoveredSession,
        agentSessionId: recoveredSession.id,
        itemCount: 0,
        projectId: selectedProject.projectId,
        source: 'agents',
        status: 'refreshed',
      });
    mocks.synchronizeProjectSessions.mockResolvedValueOnce(createImportedProjectResult());
    listSessionsByProject
      .mockResolvedValueOnce({
        items: [otherSessionRecord],
        pageInfo: { hasMore: true, mode: 'offset', page: 1, pageSize: 200 },
      })
      .mockResolvedValueOnce({
        items: [sessionRecord],
        pageInfo: { hasMore: false, mode: 'offset', page: 2, pageSize: 200 },
      });
    const onAgentSessionUnavailable = vi.fn();

    const { result } = renderHook(() => useSelectedAgentSessionItems({
      agentSessionService,
      onAgentSessionUnavailable,
      projectService,
      selectedAgentSessionId: recoveredSession.id,
      selectedProject,
      selectionRefreshToken: 0,
      synchronizeProjectSessions: mocks.synchronizeProjectSessions,
    }));

    await waitFor(() => expect(result.current).toBe(false));
    expect(mocks.synchronizeProjectSessions).toHaveBeenCalledTimes(1);
    expect(listSessionsByProject).toHaveBeenNthCalledWith(1, {
      includeArchived: true,
      page: 1,
      pageSize: 200,
      projectId: selectedProject.projectId,
    }, expect.any(Object));
    expect(listSessionsByProject).toHaveBeenNthCalledWith(2, {
      includeArchived: true,
      page: 2,
      pageSize: 200,
      projectId: selectedProject.projectId,
    }, expect.any(Object));
    expect(mocks.refreshAgentSessionItems).toHaveBeenCalledTimes(2);
    expect(mocks.refreshAgentSessionItems.mock.calls[1]?.[0].resolvedLocation?.agentSession)
      .toMatchObject({
        agentId: recoveredSession.agentId,
        id: recoveredSession.id,
        projectId: selectedProject.projectId,
      });
    expect(mocks.removeAgentSessionFromProjectsStore).not.toHaveBeenCalled();
    expect(mocks.upsertProjectIntoProjectsStore).not.toHaveBeenCalled();
    expect(mocks.upsertAgentSessionIntoProjectsStore).toHaveBeenCalledWith(
      selectedProject.projectId,
      recoveredSession,
      selectedProject.workspaceId,
      'user-a::session:0',
      {
        itemMergeMode: 'latest',
        projectMetadata: expect.objectContaining({
          agentSessions: [],
          projectId: selectedProject.projectId,
        }),
      },
    );
    expect(onAgentSessionUnavailable).not.toHaveBeenCalled();
  });
});

describe('useImportedProjectSessionSynchronization request lifecycle', () => {
  it('uses the latest synchronized callback after a rerender', async () => {
    const deferred = createDeferred<HydrateImportedProjectFromAuthorityResult | null>();
    const onSynchronizedA = vi.fn();
    const onSynchronizedB = vi.fn();
    const synchronizedResult = createImportedProjectResult();
    mocks.hydrateImportedProjectFromAuthority.mockReturnValueOnce(deferred.promise);

    const { result, rerender } = renderHook((props: {
      onSynchronized: (value: HydrateImportedProjectFromAuthorityResult) => void;
    }) => useImportedProjectSessionSynchronization({
      agentSessionService,
      knownProjects: [],
      onSynchronized: props.onSynchronized,
      projectService,
      userScope: 'user-a::session:0',
      workspaceId: 'workspace-a',
    }), {
      initialProps: { onSynchronized: onSynchronizedA },
    });

    let request!: Promise<HydrateImportedProjectFromAuthorityResult | null>;
    const staleSynchronizeImportedProject = result.current.synchronizeImportedProject;
    act(() => {
      request = staleSynchronizeImportedProject('project-a', true);
    });
    await act(async () => {
      await Promise.resolve();
    });
    rerender({ onSynchronized: onSynchronizedB });
    await act(async () => {
      deferred.resolve(synchronizedResult);
      await request;
    });

    expect(onSynchronizedA).not.toHaveBeenCalled();
    expect(onSynchronizedB).toHaveBeenCalledWith(synchronizedResult);
    expect(mocks.mutateProjectsStoreByScopeKey).toHaveBeenCalledTimes(1);
  });

  it('invalidates an old request when the workspace changes', async () => {
    const deferred = createDeferred<HydrateImportedProjectFromAuthorityResult | null>();
    const onSynchronized = vi.fn();
    mocks.hydrateImportedProjectFromAuthority.mockReturnValueOnce(deferred.promise);

    const { result, rerender } = renderHook((props: { workspaceId: string }) =>
      useImportedProjectSessionSynchronization({
        agentSessionService,
        knownProjects: [],
        onSynchronized,
        projectService,
        userScope: 'user-a::session:0',
        workspaceId: props.workspaceId,
      }), {
      initialProps: { workspaceId: 'workspace-a' },
    });

    let request!: Promise<HydrateImportedProjectFromAuthorityResult | null>;
    const staleSynchronizeImportedProject = result.current.synchronizeImportedProject;
    act(() => {
      request = staleSynchronizeImportedProject('project-a', true);
    });
    await act(async () => {
      await Promise.resolve();
    });
    rerender({ workspaceId: 'workspace-b' });
    expect(mocks.hydrateImportedProjectFromAuthority.mock.calls[0]?.[0].signal.aborted).toBe(true);
    await expect(staleSynchronizeImportedProject('project-a', true)).resolves.toBeNull();
    expect(mocks.hydrateImportedProjectFromAuthority).toHaveBeenCalledTimes(1);
    await act(async () => {
      deferred.resolve(createImportedProjectResult());
      await expect(request).resolves.toBeNull();
    });

    expect(mocks.mutateProjectsStoreByScopeKey).not.toHaveBeenCalled();
    expect(onSynchronized).not.toHaveBeenCalled();
  });

  it('invalidates an old request on unmount even when its source ignores abort', async () => {
    const deferred = createDeferred<HydrateImportedProjectFromAuthorityResult | null>();
    const onSynchronized = vi.fn();
    mocks.hydrateImportedProjectFromAuthority.mockReturnValueOnce(deferred.promise);

    const { result, unmount } = renderHook(() => useImportedProjectSessionSynchronization({
      agentSessionService,
      knownProjects: [],
      onSynchronized,
      projectService,
      userScope: 'user-a::session:0',
      workspaceId: 'workspace-a',
    }));

    let request!: Promise<HydrateImportedProjectFromAuthorityResult | null>;
    act(() => {
      request = result.current.synchronizeImportedProject('project-a', true);
    });
    await act(async () => {
      await Promise.resolve();
    });
    unmount();
    expect(mocks.hydrateImportedProjectFromAuthority.mock.calls[0]?.[0].signal.aborted).toBe(true);
    deferred.resolve(createImportedProjectResult());
    await expect(request).resolves.toBeNull();

    expect(mocks.mutateProjectsStoreByScopeKey).not.toHaveBeenCalled();
    expect(onSynchronized).not.toHaveBeenCalled();
  });
});
