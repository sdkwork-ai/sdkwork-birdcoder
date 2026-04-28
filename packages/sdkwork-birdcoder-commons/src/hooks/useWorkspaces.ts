import { useCallback, useEffect, useState } from 'react';
import {
  stringifyBirdCoderApiJson,
  type IWorkspace,
} from '@sdkwork/birdcoder-types';
import { useAuth } from '../context/AuthContext.ts';
import { useIDEServices } from '../context/IDEContext.ts';

const WORKSPACES_FETCH_TIMEOUT_MS = 30_000;

interface WorkspacesStoreSnapshot {
  hasFetched: boolean;
  isLoading: boolean;
  workspaces: IWorkspace[];
}

interface WorkspacesStore {
  inflight: Promise<IWorkspace[]> | null;
  listeners: Set<(snapshot: WorkspacesStoreSnapshot) => void>;
  snapshot: WorkspacesStoreSnapshot;
}

function createWorkspacesStoreSnapshot(): WorkspacesStoreSnapshot {
  return {
    hasFetched: false,
    isLoading: false,
    workspaces: [],
  };
}

function areWorkspacesStoreSnapshotsEqual(
  left: WorkspacesStoreSnapshot,
  right: WorkspacesStoreSnapshot,
): boolean {
  return (
    left.hasFetched === right.hasFetched &&
    left.isLoading === right.isLoading &&
    left.workspaces === right.workspaces
  );
}

function areWorkspaceCollectionsReferentiallyEqual(
  left: readonly IWorkspace[],
  right: readonly IWorkspace[],
): boolean {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  return left.every((workspace, index) => Object.is(workspace, right[index]));
}

function reuseWorkspaceCollectionIfUnchanged(
  previousWorkspaces: readonly IWorkspace[],
  nextWorkspaces: readonly IWorkspace[],
): IWorkspace[] {
  return areWorkspaceCollectionsReferentiallyEqual(previousWorkspaces, nextWorkspaces)
    ? (previousWorkspaces as IWorkspace[])
    : [...nextWorkspaces];
}

function compareWorkspaces(left: IWorkspace, right: IWorkspace): number {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function areWorkspaceScalarsEqual(left: IWorkspace, right: IWorkspace): boolean {
  return (
    left.id === right.id &&
    left.uuid === right.uuid &&
    left.tenantId === right.tenantId &&
    left.organizationId === right.organizationId &&
    left.dataScope === right.dataScope &&
    left.code === right.code &&
    left.title === right.title &&
    left.name === right.name &&
    left.description === right.description &&
    left.icon === right.icon &&
    left.color === right.color &&
    left.ownerId === right.ownerId &&
    left.leaderId === right.leaderId &&
    left.createdByUserId === right.createdByUserId &&
    left.type === right.type &&
    left.status === right.status &&
    left.startTime === right.startTime &&
    left.endTime === right.endTime &&
    left.maxMembers === right.maxMembers &&
    left.currentMembers === right.currentMembers &&
    left.memberCount === right.memberCount &&
    left.maxStorage === right.maxStorage &&
    left.usedStorage === right.usedStorage &&
    stringifyBirdCoderApiJson(left.settings ?? null) ===
      stringifyBirdCoderApiJson(right.settings ?? null) &&
    left.isPublic === right.isPublic &&
    left.isTemplate === right.isTemplate &&
    left.viewerRole === right.viewerRole
  );
}

function mergeWorkspaceForStore(
  existingWorkspace: IWorkspace | undefined,
  incomingWorkspace: IWorkspace,
): IWorkspace {
  return existingWorkspace && areWorkspaceScalarsEqual(existingWorkspace, incomingWorkspace)
    ? existingWorkspace
    : incomingWorkspace;
}

function sortWorkspaces(
  workspaces: readonly IWorkspace[],
): IWorkspace[] {
  if (workspaces.length < 2) {
    return workspaces as IWorkspace[];
  }

  for (let index = 1; index < workspaces.length; index += 1) {
    if (compareWorkspaces(workspaces[index - 1], workspaces[index]) > 0) {
      return [...workspaces].sort(compareWorkspaces);
    }
  }

  return workspaces as IWorkspace[];
}

export function mergeWorkspacesForStore(
  existingWorkspaces: readonly IWorkspace[],
  incomingWorkspaces: readonly IWorkspace[],
): IWorkspace[] {
  const existingWorkspacesById = new Map(
    existingWorkspaces.map((workspace) => [workspace.id, workspace]),
  );
  const nextWorkspacesById = new Map<string, IWorkspace>();
  incomingWorkspaces.forEach((workspace) => {
    const mergedWorkspace = mergeWorkspaceForStore(
      nextWorkspacesById.get(workspace.id) ?? existingWorkspacesById.get(workspace.id),
      workspace,
    );
    nextWorkspacesById.set(workspace.id, mergedWorkspace);
  });

  return reuseWorkspaceCollectionIfUnchanged(
    existingWorkspaces,
    sortWorkspaces(Array.from(nextWorkspacesById.values())),
  );
}

const workspacesStoresByScopeKey = new Map<string, WorkspacesStore>();

interface WorkspaceFetchTimeoutBoundary {
  clear: () => void;
  promise: Promise<never>;
}

function createWorkspaceFetchTimeoutPromise(timeoutMs: number): WorkspaceFetchTimeoutBoundary {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const promise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Timed out loading workspaces after ${timeoutMs} ms.`));
    }, timeoutMs);
  });

  return {
    clear: () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    },
    promise,
  };
}

function runWorkspaceFetchWithTimeout(
  workspaceService: ReturnType<typeof useIDEServices>['workspaceService'],
  timeoutMs: number = WORKSPACES_FETCH_TIMEOUT_MS,
): Promise<IWorkspace[]> {
  const timeoutBoundary = createWorkspaceFetchTimeoutPromise(timeoutMs);
  return Promise.race([
    workspaceService.getWorkspaces(),
    timeoutBoundary.promise,
  ]).finally(() => {
    timeoutBoundary.clear();
  });
}

function normalizeWorkspacesStoreUserScope(userId: string | null | undefined): string {
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  return normalizedUserId || 'anonymous';
}

function getWorkspacesStore(userScope: string): WorkspacesStore {
  const normalizedUserScope = normalizeWorkspacesStoreUserScope(userScope);
  let store = workspacesStoresByScopeKey.get(normalizedUserScope);
  if (!store) {
    store = {
      inflight: null,
      listeners: new Set(),
      snapshot: createWorkspacesStoreSnapshot(),
    };
    workspacesStoresByScopeKey.set(normalizedUserScope, store);
  }

  return store;
}

function emitWorkspacesStoreSnapshot(store: WorkspacesStore): void {
  const snapshot = store.snapshot;
  store.listeners.forEach((listener) => {
    listener(snapshot);
  });
}

function updateWorkspacesStoreSnapshot(
  store: WorkspacesStore,
  updater: (previousSnapshot: WorkspacesStoreSnapshot) => WorkspacesStoreSnapshot,
): void {
  const nextSnapshot = updater(store.snapshot);
  if (areWorkspacesStoreSnapshotsEqual(store.snapshot, nextSnapshot)) {
    return;
  }

  store.snapshot = nextSnapshot;
  emitWorkspacesStoreSnapshot(store);
}

async function fetchWorkspaces(
  store: WorkspacesStore,
  workspaceService: ReturnType<typeof useIDEServices>['workspaceService'],
): Promise<IWorkspace[]> {
  if (store.inflight) {
    return store.inflight;
  }

  updateWorkspacesStoreSnapshot(store, (previousSnapshot) => ({
    ...previousSnapshot,
    isLoading: true,
  }));

  const request = runWorkspaceFetchWithTimeout(workspaceService)
    .then((workspaces) => {
      const nextWorkspaces = mergeWorkspacesForStore(store.snapshot.workspaces, workspaces);
      updateWorkspacesStoreSnapshot(store, (previousSnapshot) => ({
        hasFetched: true,
        isLoading: false,
        workspaces: reuseWorkspaceCollectionIfUnchanged(
          previousSnapshot.workspaces,
          nextWorkspaces,
        ),
      }));
      return nextWorkspaces;
    })
    .catch((error) => {
      console.error('Failed to load workspaces', error);
      updateWorkspacesStoreSnapshot(store, (previousSnapshot) => ({
        ...previousSnapshot,
        hasFetched: true,
        isLoading: false,
      }));
      return store.snapshot.workspaces;
    })
    .finally(() => {
      if (store.inflight === request) {
        store.inflight = null;
      }
    });

  store.inflight = request;
  return request;
}

function mutateWorkspacesStore(
  userScope: string,
  updater: (workspaces: readonly IWorkspace[]) => IWorkspace[],
): void {
  const store = getWorkspacesStore(userScope);
  updateWorkspacesStoreSnapshot(store, (previousSnapshot) => {
    const nextWorkspaces = mergeWorkspacesForStore(
      previousSnapshot.workspaces,
      updater(previousSnapshot.workspaces),
    );
    if (
      previousSnapshot.hasFetched &&
      areWorkspaceCollectionsReferentiallyEqual(
        previousSnapshot.workspaces,
        nextWorkspaces,
      )
    ) {
      return previousSnapshot;
    }

    return {
      hasFetched: true,
      isLoading: previousSnapshot.isLoading,
      workspaces: reuseWorkspaceCollectionIfUnchanged(
        previousSnapshot.workspaces,
        nextWorkspaces,
      ),
    };
  });
}

export interface UseWorkspacesOptions {
  isActive?: boolean;
}

export function useWorkspaces(options: UseWorkspacesOptions = {}) {
  const { workspaceService } = useIDEServices();
  const { user } = useAuth();
  const isActive = options.isActive ?? true;
  const normalizedUserScope = normalizeWorkspacesStoreUserScope(user?.id);
  const [storeSnapshot, setStoreSnapshot] = useState<WorkspacesStoreSnapshot>(
    () => getWorkspacesStore(normalizedUserScope).snapshot,
  );

  useEffect(() => {
    if (!isActive) {
      setStoreSnapshot(createWorkspacesStoreSnapshot());
      return;
    }

    const store = getWorkspacesStore(normalizedUserScope);
    setStoreSnapshot(store.snapshot);

    const handleStoreChange = (nextSnapshot: WorkspacesStoreSnapshot) => {
      setStoreSnapshot(nextSnapshot);
    };

    store.listeners.add(handleStoreChange);
    if (!store.snapshot.hasFetched && !store.inflight) {
      void fetchWorkspaces(store, workspaceService);
    }

    return () => {
      store.listeners.delete(handleStoreChange);
      if (store.listeners.size === 0 && !store.inflight) {
        workspacesStoresByScopeKey.delete(normalizedUserScope);
      }
    };
  }, [isActive, normalizedUserScope, workspaceService]);

  const refreshWorkspaces = useCallback(async () => {
    return fetchWorkspaces(getWorkspacesStore(normalizedUserScope), workspaceService);
  }, [normalizedUserScope, workspaceService]);

  const createWorkspace = useCallback(
    async (name: string, description?: string) => {
      const newWorkspace = await workspaceService.createWorkspace(name, description);
      mutateWorkspacesStore(normalizedUserScope, (previousWorkspaces) => [
        ...previousWorkspaces.filter((workspace) => workspace.id !== newWorkspace.id),
        newWorkspace,
      ]);
      return newWorkspace;
    },
    [normalizedUserScope, workspaceService],
  );

  const updateWorkspace = useCallback(
    async (id: string, name: string) => {
      const updatedWorkspace = await workspaceService.updateWorkspace(id, name);
      mutateWorkspacesStore(normalizedUserScope, (previousWorkspaces) =>
        previousWorkspaces.map((workspace) =>
          workspace.id === id ? updatedWorkspace : workspace,
        ),
      );
      return updatedWorkspace;
    },
    [normalizedUserScope, workspaceService],
  );

  const deleteWorkspace = useCallback(
    async (id: string) => {
      await workspaceService.deleteWorkspace(id);
      mutateWorkspacesStore(normalizedUserScope, (previousWorkspaces) =>
        previousWorkspaces.filter((workspace) => workspace.id !== id),
      );
    },
    [normalizedUserScope, workspaceService],
  );

  return {
    hasFetched: storeSnapshot.hasFetched,
    workspaces: storeSnapshot.workspaces,
    isLoading: storeSnapshot.isLoading,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    refreshWorkspaces,
  };
}
