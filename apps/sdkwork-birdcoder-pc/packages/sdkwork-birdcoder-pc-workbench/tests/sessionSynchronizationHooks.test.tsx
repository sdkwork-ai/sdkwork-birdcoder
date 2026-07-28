// @vitest-environment jsdom

import { act } from 'react';
import { cleanup, renderHook } from '@testing-library/react';
import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  IAgentSessionService,
  IProjectService,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useImportedProjectSessionSynchronization } from '../src/hooks/useImportedProjectSessionSynchronization.ts';
import { useSessionRefreshActions } from '../src/hooks/useSessionRefreshActions.ts';
import type { HydrateImportedProjectFromAuthorityResult } from '../src/workbench/importedProjectHydration.ts';

const mocks = vi.hoisted(() => ({
  applyProjectSessionActivityRefresh: vi.fn((projects: readonly AgentProjectView[]) => projects),
  auth: {
    sessionRevision: 0,
    user: { email: 'user-a@example.com', id: 'user-a', name: 'User A' },
  },
  hydrateImportedProjectFromAuthority: vi.fn(),
  loadEarlierAgentSessionItems: vi.fn(),
  mutateProjectsStoreByScopeKey: vi.fn(),
  refreshAgentSessionItems: vi.fn(),
  synchronizeProjectSessions: vi.fn(),
  upsertAgentSessionIntoProjectsStore: vi.fn(),
  upsertProjectIntoProjectsStore: vi.fn(),
}));

vi.mock('../src/context/AuthContext.ts', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../src/stores/projectsStore.ts', () => ({
  buildProjectsStoreScopeKey: (userScope: string, workspaceId: string) =>
    `${userScope}\u0001${workspaceId}`,
  mutateProjectsStoreByScopeKey: mocks.mutateProjectsStoreByScopeKey,
  upsertAgentSessionIntoProjectsStore: mocks.upsertAgentSessionIntoProjectsStore,
  upsertProjectIntoProjectsStore: mocks.upsertProjectIntoProjectsStore,
}));

vi.mock('../src/workbench/importedProjectHydration.ts', () => ({
  hydrateImportedProjectFromAuthority: mocks.hydrateImportedProjectFromAuthority,
}));

vi.mock('../src/workbench/sessionRefresh.ts', () => ({
  applyProjectSessionActivityRefresh: mocks.applyProjectSessionActivityRefresh,
  loadEarlierAgentSessionItems: mocks.loadEarlierAgentSessionItems,
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

const agentSessionService = {} as IAgentSessionService;
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
