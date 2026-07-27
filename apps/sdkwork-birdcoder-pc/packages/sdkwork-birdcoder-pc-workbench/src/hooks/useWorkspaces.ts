import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_LIST_PAGE_SIZE } from '@sdkwork/utils/pagination';
import type { AgentWorkspaceView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { AgentWorkspaceViewPage } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import { useAuth } from '../context/AuthContext.ts';
import { buildBirdCoderAuthSessionInventoryScope } from '../context/authSessionScope.ts';
import { useIDEServices } from '../context/IDEContext.ts';

interface WorkspaceInventory {
  error: string | null;
  hasFetched: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  pageInfo: AgentWorkspaceViewPage['pageInfo'] | null;
  workspaces: AgentWorkspaceView[];
}

const inventoryByRequestKey = new Map<string, Promise<AgentWorkspaceViewPage>>();

function normalizeWorkspaceId(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

export function mergeWorkspacePages(
  current: readonly AgentWorkspaceView[],
  incoming: readonly AgentWorkspaceView[],
): AgentWorkspaceView[] {
  const workspacesById = new Map(
    current.map((workspace) => [workspace.workspaceId, workspace]),
  );
  incoming.forEach((workspace) => {
    workspacesById.set(workspace.workspaceId, workspace);
  });
  return Array.from(workspacesById.values());
}

export function selectInitialWorkspace(
  workspaces: readonly AgentWorkspaceView[],
  preferredWorkspaceId?: string | null,
): AgentWorkspaceView | null {
  const preferredId = preferredWorkspaceId?.trim();
  return (
    (preferredId
      ? workspaces.find((workspace) => workspace.workspaceId === preferredId)
      : undefined) ??
    workspaces.find((workspace) => workspace.isDefault && workspace.status === 'active') ??
    workspaces.find((workspace) => workspace.status === 'active') ??
    null
  );
}

export function useWorkspaces(options?: {
  isActive?: boolean;
  preferredWorkspaceId?: string | null;
}) {
  const { workspaceService } = useIDEServices();
  const { sessionRevision, user } = useAuth();
  const sessionScope = buildBirdCoderAuthSessionInventoryScope(user?.id, sessionRevision);
  const activeSessionScopeRef = useRef(sessionScope);
  activeSessionScopeRef.current = sessionScope;
  const isActive = options?.isActive ?? true;
  const [inventory, setInventory] = useState<WorkspaceInventory>({
    error: null,
    hasFetched: false,
    isLoading: false,
    isLoadingMore: false,
    pageInfo: null,
    workspaces: [],
  });
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const selectedWorkspaceIdRef = useRef(selectedWorkspaceId);
  selectedWorkspaceIdRef.current = selectedWorkspaceId;

  const refreshWorkspaces = useCallback(async () => {
    if (!isActive || !sessionScope) {
      setInventory({
        error: null,
        hasFetched: false,
        isLoading: false,
        isLoadingMore: false,
        pageInfo: null,
        workspaces: [],
      });
      setSelectedWorkspaceId('');
      return [];
    }

    setInventory((previous) => ({
      ...previous,
      error: null,
      isLoading: true,
      isLoadingMore: false,
    }));
    const requestKey = `${sessionScope}:page:1`;
    let request = inventoryByRequestKey.get(requestKey);
    if (!request) {
      request = (async () => {
        await workspaceService.ensureDefaultWorkspace();
        return workspaceService.getWorkspacesPage({
          page: 1,
          pageSize: DEFAULT_LIST_PAGE_SIZE,
          status: 'active',
        });
      })().finally(() => {
        inventoryByRequestKey.delete(requestKey);
      });
      inventoryByRequestKey.set(requestKey, request);
    }

    try {
      const response = await request;
      if (activeSessionScopeRef.current !== sessionScope) {
        return response.items;
      }
      const preferredWorkspaceId =
        normalizeWorkspaceId(selectedWorkspaceIdRef.current) ||
        normalizeWorkspaceId(options?.preferredWorkspaceId);
      let resolvedWorkspaces = response.items;
      if (
        preferredWorkspaceId &&
        !resolvedWorkspaces.some(
          (workspace) => workspace.workspaceId === preferredWorkspaceId,
        )
      ) {
        try {
          const preferredWorkspace = await workspaceService.getWorkspaceById(
            preferredWorkspaceId,
          );
          if (
            activeSessionScopeRef.current === sessionScope &&
            preferredWorkspace.workspaceId === preferredWorkspaceId &&
            preferredWorkspace.status === 'active'
          ) {
            resolvedWorkspaces = mergeWorkspacePages(
              resolvedWorkspaces,
              [preferredWorkspace],
            );
          }
        } catch {
          // A stale recovery reference must not block the authoritative first page.
        }
      }
      if (activeSessionScopeRef.current !== sessionScope) {
        return resolvedWorkspaces;
      }
      setInventory({
        error: null,
        hasFetched: true,
        isLoading: false,
        isLoadingMore: false,
        pageInfo: response.pageInfo,
        workspaces: resolvedWorkspaces,
      });
      setSelectedWorkspaceId((current) =>
        selectInitialWorkspace(
          resolvedWorkspaces,
          current || options?.preferredWorkspaceId,
        )?.workspaceId ?? '',
      );
      return resolvedWorkspaces;
    } catch (error) {
      if (activeSessionScopeRef.current !== sessionScope) {
        throw error;
      }
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : 'Failed to load Workspaces';
      setInventory({
        error: message,
        hasFetched: true,
        isLoading: false,
        isLoadingMore: false,
        pageInfo: null,
        workspaces: [],
      });
      setSelectedWorkspaceId('');
      throw error;
    }
  }, [isActive, options?.preferredWorkspaceId, sessionScope, workspaceService]);

  const loadMoreWorkspaces = useCallback(async () => {
    const pageInfo = inventory.pageInfo;
    if (
      !isActive ||
      !sessionScope ||
      !pageInfo?.hasMore ||
      inventory.isLoading ||
      inventory.isLoadingMore
    ) {
      return inventory.workspaces;
    }

    const nextPage = (pageInfo.page ?? 1) + 1;
    const requestKey = `${sessionScope}:page:${nextPage}`;
    setInventory((previous) => ({
      ...previous,
      error: null,
      isLoadingMore: true,
    }));
    let request = inventoryByRequestKey.get(requestKey);
    if (!request) {
      request = workspaceService.getWorkspacesPage({
        page: nextPage,
        pageSize: pageInfo.pageSize ?? DEFAULT_LIST_PAGE_SIZE,
        status: 'active',
      }).finally(() => {
        inventoryByRequestKey.delete(requestKey);
      });
      inventoryByRequestKey.set(requestKey, request);
    }

    try {
      const response = await request;
      if (activeSessionScopeRef.current !== sessionScope) {
        return response.items;
      }
      const mergedWorkspaces = mergeWorkspacePages(
        inventory.workspaces,
        response.items,
      );
      setInventory((previous) => ({
        ...previous,
        error: null,
        hasFetched: true,
        isLoadingMore: false,
        pageInfo: response.pageInfo,
        workspaces: mergeWorkspacePages(previous.workspaces, response.items),
      }));
      setSelectedWorkspaceId((current) =>
        selectInitialWorkspace(
          mergedWorkspaces,
          current || options?.preferredWorkspaceId,
        )?.workspaceId ?? '',
      );
      return mergedWorkspaces;
    } catch (error) {
      if (activeSessionScopeRef.current !== sessionScope) {
        throw error;
      }
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : 'Failed to load more Workspaces';
      setInventory((previous) => ({
        ...previous,
        error: message,
        isLoadingMore: false,
      }));
      throw error;
    }
  }, [
    inventory.isLoading,
    inventory.isLoadingMore,
    inventory.pageInfo,
    inventory.workspaces,
    isActive,
    options?.preferredWorkspaceId,
    sessionScope,
    workspaceService,
  ]);

  const createWorkspace = useCallback(async (name: string, description?: string) => {
    if (!sessionScope) {
      throw new Error('An authenticated session is required');
    }
    const workspace = await workspaceService.createWorkspace(name, description);
    if (activeSessionScopeRef.current !== sessionScope) {
      return workspace;
    }
    setInventory((previous) => ({
      ...previous,
      error: null,
      hasFetched: true,
      workspaces: mergeWorkspacePages(previous.workspaces, [workspace]),
    }));
    setSelectedWorkspaceId(workspace.workspaceId);
    return workspace;
  }, [sessionScope, workspaceService]);

  const updateWorkspace = useCallback(async (
    workspaceId: string,
    expectedVersion: string,
    updates: { name?: string; description?: string | null },
  ) => {
    if (!sessionScope) {
      throw new Error('An authenticated session is required');
    }
    const workspace = await workspaceService.updateWorkspace(
      workspaceId,
      expectedVersion,
      updates,
    );
    if (activeSessionScopeRef.current !== sessionScope) {
      return workspace;
    }
    setInventory((previous) => ({
      ...previous,
      error: null,
      workspaces: previous.workspaces.map((current) =>
        current.workspaceId === workspace.workspaceId ? workspace : current,
      ),
    }));
    return workspace;
  }, [sessionScope, workspaceService]);

  const removeWorkspaceFromActiveInventory = useCallback((workspaceId: string) => {
    const remainingWorkspaces = inventory.workspaces.filter(
      (workspace) => workspace.workspaceId !== workspaceId,
    );
    setInventory((previous) => ({
      ...previous,
      error: null,
      workspaces: previous.workspaces.filter(
        (workspace) => workspace.workspaceId !== workspaceId,
      ),
    }));
    setSelectedWorkspaceId((current) =>
      current === workspaceId
        ? selectInitialWorkspace(remainingWorkspaces)?.workspaceId ?? ''
        : current,
    );
  }, [inventory.workspaces]);

  const archiveWorkspace = useCallback(async (
    workspaceId: string,
    expectedVersion: string,
  ) => {
    if (!sessionScope) {
      throw new Error('An authenticated session is required');
    }
    const workspace = await workspaceService.archiveWorkspace(workspaceId, expectedVersion);
    if (activeSessionScopeRef.current === sessionScope) {
      removeWorkspaceFromActiveInventory(workspaceId);
    }
    return workspace;
  }, [removeWorkspaceFromActiveInventory, sessionScope, workspaceService]);

  const deleteWorkspace = useCallback(async (
    workspaceId: string,
    expectedVersion: string,
  ) => {
    if (!sessionScope) {
      throw new Error('An authenticated session is required');
    }
    await workspaceService.deleteWorkspace(workspaceId, expectedVersion);
    if (activeSessionScopeRef.current === sessionScope) {
      removeWorkspaceFromActiveInventory(workspaceId);
    }
  }, [removeWorkspaceFromActiveInventory, sessionScope, workspaceService]);

  useEffect(() => {
    if (!isActive || !sessionScope) {
      setInventory({
        error: null,
        hasFetched: false,
        isLoading: false,
        isLoadingMore: false,
        pageInfo: null,
        workspaces: [],
      });
      setSelectedWorkspaceId('');
      return;
    }
    void refreshWorkspaces().catch(() => undefined);
  }, [isActive, refreshWorkspaces, sessionScope]);

  const selectedWorkspace = useMemo(
    () => inventory.workspaces.find(
      (workspace) => workspace.workspaceId === selectedWorkspaceId,
    ) ?? null,
    [inventory.workspaces, selectedWorkspaceId],
  );

  return {
    ...inventory,
    selectedWorkspace,
    selectedWorkspaceId,
    selectWorkspace: setSelectedWorkspaceId,
    createWorkspace,
    updateWorkspace,
    archiveWorkspace,
    deleteWorkspace,
    hasMore: inventory.pageInfo?.hasMore ?? false,
    loadMoreWorkspaces,
    refreshWorkspaces,
  };
}
