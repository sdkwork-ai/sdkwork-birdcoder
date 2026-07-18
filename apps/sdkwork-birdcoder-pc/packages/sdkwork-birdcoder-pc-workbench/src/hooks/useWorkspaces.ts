import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_LIST_PAGE_SIZE } from '@sdkwork/utils/pagination';
import {
  stringifyBirdCoderApiJson,
  type IWorkspace,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { useAuth } from '../context/AuthContext.ts';
import { useIDEServices } from '../context/IDEContext.ts';
import type {
  BirdCoderServiceListPage,
  BirdCoderServiceOffsetPageInfo,
  BirdCoderServicePageRequest,
} from '../services/interfaces/IProjectService.ts';

const WORKSPACES_FETCH_TIMEOUT_MS = 30_000;
const MAX_TARGET_WORKSPACE_RESOLUTION_PAGES = 20;

interface WorkspacesStoreSnapshot {
  error: string | null;
  hasFetched: boolean;
  isLoading: boolean;
  pageInfo: BirdCoderServiceOffsetPageInfo | null;
  workspaces: IWorkspace[];
}

interface WorkspacesStore {
  inventoryVersion: number;
  inflight: Promise<IWorkspace[]> | null;
  inflightKey: string | null;
  listeners: Set<(snapshot: WorkspacesStoreSnapshot) => void>;
  snapshot: WorkspacesStoreSnapshot;
}

function createWorkspacesStoreSnapshot(): WorkspacesStoreSnapshot {
  return {
    error: null,
    hasFetched: false,
    isLoading: false,
    pageInfo: null,
    workspaces: [],
  };
}

function areWorkspacesStoreSnapshotsEqual(
  left: WorkspacesStoreSnapshot,
  right: WorkspacesStoreSnapshot,
): boolean {
  return (
    left.error === right.error &&
    left.hasFetched === right.hasFetched &&
    left.isLoading === right.isLoading &&
    left.pageInfo === right.pageInfo &&
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
  request: BirdCoderServicePageRequest,
  timeoutMs: number = WORKSPACES_FETCH_TIMEOUT_MS,
): Promise<BirdCoderServiceListPage<IWorkspace>> {
  const timeoutBoundary = createWorkspaceFetchTimeoutPromise(timeoutMs);
  return Promise.race([
    workspaceService.getWorkspacesPage(request),
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
      inventoryVersion: 0,
      inflight: null,
      inflightKey: null,
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
  pageRequest: BirdCoderServicePageRequest,
  mode: 'append' | 'replace' = 'replace',
): Promise<IWorkspace[]> {
  const requestKey = `${mode}:${pageRequest.page}:${pageRequest.pageSize}`;
  if (store.inflight) {
    if (store.inflightKey === requestKey) {
      return store.inflight;
    }

    await store.inflight.catch(() => undefined);
    return fetchWorkspaces(store, workspaceService, pageRequest, mode);
  }

  updateWorkspacesStoreSnapshot(store, (previousSnapshot) => ({
    ...previousSnapshot,
    error: null,
    isLoading: true,
  }));

  const requestInventoryVersion = store.inventoryVersion;
  const request = runWorkspaceFetchWithTimeout(
    workspaceService,
    pageRequest,
    WORKSPACES_FETCH_TIMEOUT_MS,
  )
    .then((page) => {
      if (store.inventoryVersion !== requestInventoryVersion) {
        updateWorkspacesStoreSnapshot(store, (previousSnapshot) => ({
          ...previousSnapshot,
          isLoading: false,
          pageInfo: null,
        }));
        return store.snapshot.workspaces;
      }

      const nextWorkspaces = mergeWorkspacesForStore(
        store.snapshot.workspaces,
        mode === 'append'
          ? [...store.snapshot.workspaces, ...page.items]
          : page.items,
      );
      updateWorkspacesStoreSnapshot(store, (previousSnapshot) => ({
        error: null,
        hasFetched: true,
        isLoading: false,
        pageInfo: page.pageInfo,
        workspaces: mergeWorkspacesForStore(
          previousSnapshot.workspaces,
          mode === 'append'
            ? [...previousSnapshot.workspaces, ...page.items]
            : page.items,
        ),
      }));
      return nextWorkspaces;
    })
    .catch((error) => {
      // Do not let a stale page request overwrite state produced by a newer
      // local mutation or realtime inventory update.
      if (store.inventoryVersion !== requestInventoryVersion) {
        throw error;
      }

      console.error('Failed to load workspaces', error);
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to load workspaces';
      updateWorkspacesStoreSnapshot(store, (previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
        hasFetched: true,
        isLoading: false,
      }));
      throw error;
    })
    .finally(() => {
      if (store.inflight === request) {
        store.inflight = null;
        store.inflightKey = null;
      }
    });

  store.inflight = request;
  store.inflightKey = requestKey;
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

    store.inventoryVersion += 1;

    return {
      error: null,
      hasFetched: true,
      isLoading: previousSnapshot.isLoading,
      pageInfo: null,
      workspaces: reuseWorkspaceCollectionIfUnchanged(
        previousSnapshot.workspaces,
        nextWorkspaces,
      ),
    };
  });
}

export interface UseWorkspacesOptions {
  isActive?: boolean;
  limit?: number;
  offset?: number;
  targetWorkspaceId?: string | null;
}

export function useWorkspaces(options: UseWorkspacesOptions = {}) {
  const { workspaceService } = useIDEServices();
  const { user } = useAuth();
  const isActive = options.isActive ?? true;
  const normalizedUserScope = normalizeWorkspacesStoreUserScope(user?.id);
  const pageRequest = useMemo<BirdCoderServicePageRequest>(
    () => {
      const pageSize = options.limit ?? DEFAULT_LIST_PAGE_SIZE;
      const offset = options.offset ?? 0;
      if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 200) {
        throw new Error('Workspace page size must be an integer between 1 and 200.');
      }
      if (!Number.isSafeInteger(offset) || offset < 0 || offset % pageSize !== 0) {
        throw new Error('Workspace offset must be a non-negative multiple of page size.');
      }
      return {
        page: offset / pageSize + 1,
        pageSize,
      };
    },
    [options?.limit, options?.offset],
  );
  const isDefaultPagination =
    pageRequest.page === 1 && pageRequest.pageSize === DEFAULT_LIST_PAGE_SIZE;
  const storeScopeKey = isDefaultPagination
    ? normalizedUserScope
    : `${normalizedUserScope}::page:${pageRequest.pageSize}:${pageRequest.page}`;
  const [storeSnapshot, setStoreSnapshot] = useState<WorkspacesStoreSnapshot>(
    () => getWorkspacesStore(storeScopeKey).snapshot,
  );

  useEffect(() => {
    if (!isActive) {
      setStoreSnapshot(createWorkspacesStoreSnapshot());
      return;
    }

    const store = getWorkspacesStore(storeScopeKey);
    setStoreSnapshot(store.snapshot);

    const handleStoreChange = (nextSnapshot: WorkspacesStoreSnapshot) => {
      setStoreSnapshot(nextSnapshot);
    };

    store.listeners.add(handleStoreChange);
    if (!store.snapshot.hasFetched && !store.inflight) {
      void fetchWorkspaces(store, workspaceService, pageRequest).catch(() => {
        // Error state is already propagated through the shared store snapshot.
      });
    }

    return () => {
      store.listeners.delete(handleStoreChange);
      if (store.listeners.size === 0) {
        workspacesStoresByScopeKey.delete(storeScopeKey);
      }
    };
  }, [isActive, pageRequest, storeScopeKey, workspaceService]);

  const refreshWorkspaces = useCallback(async () => {
    return fetchWorkspaces(getWorkspacesStore(storeScopeKey), workspaceService, pageRequest);
  }, [pageRequest, storeScopeKey, workspaceService]);

  const loadMoreWorkspaces = useCallback(async () => {
    const store = getWorkspacesStore(storeScopeKey);
    const pageInfo = store.snapshot.pageInfo;
    if (!pageInfo?.hasMore) {
      return store.snapshot.workspaces;
    }

    return fetchWorkspaces(
      store,
      workspaceService,
      {
        page: pageInfo.page + 1,
        pageSize: pageInfo.pageSize,
      },
      'append',
    );
  }, [storeScopeKey, workspaceService]);

  useEffect(() => {
    if (
      !isActive ||
      !storeSnapshot.hasFetched ||
      storeSnapshot.isLoading ||
      storeSnapshot.error ||
      storeSnapshot.pageInfo !== null
    ) {
      return;
    }

    void fetchWorkspaces(
      getWorkspacesStore(storeScopeKey),
      workspaceService,
      {
        page: 1,
        pageSize: pageRequest.pageSize,
      },
    ).catch(() => {
      // Error state is already propagated through the shared store snapshot.
    });
  }, [
    isActive,
    pageRequest.pageSize,
    storeScopeKey,
    storeSnapshot.error,
    storeSnapshot.hasFetched,
    storeSnapshot.isLoading,
    storeSnapshot.pageInfo,
    workspaceService,
  ]);

  const normalizedTargetWorkspaceId = options.targetWorkspaceId?.trim() ?? '';
  const targetResolutionStateRef = useRef({
    key: '',
    pagesRequested: 0,
  });
  const targetResolutionKey = `${normalizedUserScope}\u0001${normalizedTargetWorkspaceId}`;
  if (targetResolutionStateRef.current.key !== targetResolutionKey) {
    targetResolutionStateRef.current = {
      key: targetResolutionKey,
      pagesRequested: 0,
    };
  }
  const targetResolutionBudgetExhausted =
    targetResolutionStateRef.current.pagesRequested >= MAX_TARGET_WORKSPACE_RESOLUTION_PAGES;
  const hasTargetWorkspace = normalizedTargetWorkspaceId
    ? storeSnapshot.workspaces.some((workspace) => workspace.id === normalizedTargetWorkspaceId)
    : true;
  const isResolvingTargetWorkspace = Boolean(
    normalizedTargetWorkspaceId &&
      !hasTargetWorkspace &&
      !storeSnapshot.error &&
      !targetResolutionBudgetExhausted &&
      (
        !storeSnapshot.hasFetched ||
        storeSnapshot.pageInfo === null ||
        storeSnapshot.pageInfo.hasMore
      ),
  );

  useEffect(() => {
    if (
      !isActive ||
      !storeSnapshot.hasFetched ||
      storeSnapshot.isLoading ||
      storeSnapshot.error ||
      !isResolvingTargetWorkspace ||
      !storeSnapshot.pageInfo?.hasMore
    ) {
      return;
    }

    targetResolutionStateRef.current.pagesRequested += 1;
    void loadMoreWorkspaces().catch(() => {
      // Error state is already propagated through the shared store snapshot.
    });
  }, [
    isActive,
    isResolvingTargetWorkspace,
    loadMoreWorkspaces,
    storeSnapshot.hasFetched,
    storeSnapshot.isLoading,
    storeSnapshot.error,
    storeSnapshot.pageInfo?.hasMore,
    targetResolutionBudgetExhausted,
  ]);

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
    error: storeSnapshot.error,
    hasFetched:
      storeSnapshot.hasFetched &&
      storeSnapshot.pageInfo !== null &&
      !isResolvingTargetWorkspace,
    hasMore: storeSnapshot.pageInfo?.hasMore ?? false,
    workspaces: storeSnapshot.workspaces,
    isLoading: storeSnapshot.isLoading,
    isLoadingMore: storeSnapshot.isLoading && storeSnapshot.hasFetched,
    pageInfo: storeSnapshot.pageInfo,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    loadMoreWorkspaces,
    refreshWorkspaces,
  };
}
