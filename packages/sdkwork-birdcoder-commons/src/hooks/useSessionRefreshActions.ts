import { useCallback, useState } from 'react';
import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import {
  refreshCodingSessionMessages,
  refreshProjectSessions,
} from '../workbench/sessionRefresh.ts';

type ToastTone = 'error' | 'success';

type SessionRefreshCoreReadService = NonNullable<
  Parameters<typeof refreshCodingSessionMessages>[0]['coreReadService']
>;

interface PreservedSessionRefreshSelection {
  codingSessionId: string | null;
  projectId: string;
}

interface SessionRefreshMessages {
  failedToRefreshProjectSessions: string;
  failedToRefreshSessionMessages: string;
  projectSessionsRefreshed: (projectName: string) => string;
  sessionMessagesRefreshed: (codingSessionTitle: string) => string;
}

export interface UseSessionRefreshActionsOptions {
  addToast: (message: string, tone: ToastTone) => void;
  coreReadService?: SessionRefreshCoreReadService;
  getPreservedSelection: () => PreservedSessionRefreshSelection;
  messages: SessionRefreshMessages;
  onSessionInventoryRefresh?: () => Promise<void>;
  projectService: IProjectService;
  refreshProjects: () => Promise<void>;
  resolveCodingSessionTitle: (codingSessionId: string) => string;
  resolveProjectName: (projectId: string) => string;
  restoreSelectionAfterRefresh: (
    projectId: string,
    codingSessionId: string | null,
  ) => void;
  workspaceId?: string;
}

export function useSessionRefreshActions({
  addToast,
  coreReadService,
  getPreservedSelection,
  messages,
  onSessionInventoryRefresh,
  projectService,
  refreshProjects,
  resolveCodingSessionTitle,
  resolveProjectName,
  restoreSelectionAfterRefresh,
  workspaceId,
}: UseSessionRefreshActionsOptions) {
  const [refreshingProjectId, setRefreshingProjectId] = useState<string | null>(null);
  const [refreshingCodingSessionId, setRefreshingCodingSessionId] = useState<string | null>(null);

  const reloadProjectsAndInventory = useCallback(async () => {
    await Promise.all([refreshProjects(), onSessionInventoryRefresh?.()]);
  }, [onSessionInventoryRefresh, refreshProjects]);

  const handleRefreshProjectSessions = useCallback(async (targetProjectId: string) => {
    const normalizedWorkspaceId = workspaceId?.trim() ?? '';
    if (!normalizedWorkspaceId) {
      addToast(messages.failedToRefreshProjectSessions, 'error');
      return;
    }

    const preservedSelection = getPreservedSelection();
    const projectName = resolveProjectName(targetProjectId);

    setRefreshingProjectId(targetProjectId);
    try {
      const result = await refreshProjectSessions({
        projectService,
        workspaceId: normalizedWorkspaceId,
      });
      if (result.status !== 'refreshed') {
        addToast(messages.failedToRefreshProjectSessions, 'error');
        return;
      }

      await reloadProjectsAndInventory();
      restoreSelectionAfterRefresh(
        preservedSelection.projectId,
        preservedSelection.codingSessionId,
      );
      addToast(messages.projectSessionsRefreshed(projectName), 'success');
    } catch (error) {
      console.error('Failed to refresh project sessions', error);
      addToast(messages.failedToRefreshProjectSessions, 'error');
    } finally {
      setRefreshingProjectId(null);
    }
  }, [
    addToast,
    getPreservedSelection,
    messages,
    projectService,
    reloadProjectsAndInventory,
    resolveProjectName,
    restoreSelectionAfterRefresh,
    workspaceId,
  ]);

  const handleRefreshCodingSessionMessages = useCallback(async (codingSessionId: string) => {
    const preservedSelection = getPreservedSelection();
    const codingSessionTitle = resolveCodingSessionTitle(codingSessionId);

    setRefreshingCodingSessionId(codingSessionId);
    try {
      const result = await refreshCodingSessionMessages({
        codingSessionId,
        coreReadService,
        projectService,
        workspaceId,
      });
      if (result.status !== 'refreshed') {
        addToast(messages.failedToRefreshSessionMessages, 'error');
        return;
      }

      await reloadProjectsAndInventory();
      restoreSelectionAfterRefresh(
        preservedSelection.projectId,
        preservedSelection.codingSessionId,
      );
      addToast(messages.sessionMessagesRefreshed(codingSessionTitle), 'success');
    } catch (error) {
      console.error('Failed to refresh coding session messages', error);
      addToast(messages.failedToRefreshSessionMessages, 'error');
    } finally {
      setRefreshingCodingSessionId(null);
    }
  }, [
    addToast,
    coreReadService,
    getPreservedSelection,
    messages,
    projectService,
    reloadProjectsAndInventory,
    resolveCodingSessionTitle,
    restoreSelectionAfterRefresh,
    workspaceId,
  ]);

  return {
    handleRefreshCodingSessionMessages,
    handleRefreshProjectSessions,
    refreshingCodingSessionId,
    refreshingProjectId,
  };
}
