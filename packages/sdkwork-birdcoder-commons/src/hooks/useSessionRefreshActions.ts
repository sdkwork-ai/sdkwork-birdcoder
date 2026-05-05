import { useCallback, useState } from 'react';
import type { BirdCoderCodingSession, BirdCoderProject } from '@sdkwork/birdcoder-types';
import { useAuth } from '../context/AuthContext.ts';
import {
  upsertCodingSessionIntoProjectsStore,
  upsertProjectIntoProjectsStore,
} from '../stores/projectsStore.ts';
import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import {
  refreshCodingSessionMessages,
  refreshProjectSessions,
} from '../workbench/sessionRefresh.ts';

type ToastTone = 'error' | 'success';

type SessionRefreshCoreReadService = NonNullable<
  Parameters<typeof refreshCodingSessionMessages>[0]['coreReadService']
>;

interface SessionRefreshCodingSessionLocation {
  codingSession: BirdCoderCodingSession;
  project: BirdCoderProject;
}

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
  projectService: IProjectService;
  resolveCodingSessionLocation?: (
    codingSessionId: string,
    projectId?: string | null,
  ) => SessionRefreshCodingSessionLocation | null;
  resolveCodingSessionTitle: (codingSessionId: string, projectId?: string | null) => string;
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
  projectService,
  resolveCodingSessionLocation,
  resolveCodingSessionTitle,
  resolveProjectName,
  restoreSelectionAfterRefresh,
  workspaceId,
}: UseSessionRefreshActionsOptions) {
  const { user } = useAuth();
  const normalizedUserScope = user?.id?.trim() ?? 'anonymous';
  const [refreshingProjectId, setRefreshingProjectId] = useState<string | null>(null);
  const [refreshingCodingSessionScope, setRefreshingCodingSessionScope] = useState<{
    codingSessionId: string;
    projectId: string | null;
  } | null>(null);

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
        coreReadService,
        identityScope: normalizedUserScope,
        projectId: targetProjectId,
        projectService,
        workspaceId: normalizedWorkspaceId,
      });
      if (result.status !== 'refreshed') {
        addToast(messages.failedToRefreshProjectSessions, 'error');
        return;
      }

      for (const project of result.projects ?? []) {
        upsertProjectIntoProjectsStore(
          project.workspaceId?.trim() || normalizedWorkspaceId,
          project,
          normalizedUserScope,
        );
      }
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
    coreReadService,
    getPreservedSelection,
    messages,
    normalizedUserScope,
    projectService,
    resolveProjectName,
    restoreSelectionAfterRefresh,
    workspaceId,
  ]);

  const handleRefreshCodingSessionMessages = useCallback(async (
    codingSessionId: string,
    projectId?: string | null,
  ) => {
    const normalizedProjectId = projectId?.trim() ?? '';
    const preservedSelection = getPreservedSelection();
    const codingSessionTitle = resolveCodingSessionTitle(codingSessionId, normalizedProjectId);
    const resolvedLocation = normalizedProjectId
      ? resolveCodingSessionLocation?.(codingSessionId, normalizedProjectId) ?? null
      : null;
    if (normalizedProjectId && !resolvedLocation) {
      addToast(messages.failedToRefreshSessionMessages, 'error');
      return;
    }

    setRefreshingCodingSessionScope({
      codingSessionId,
      projectId: normalizedProjectId || null,
    });
    try {
      const result = await refreshCodingSessionMessages({
        codingSessionId,
        coreReadService,
        identityScope: normalizedUserScope,
        projectService,
        ...(resolvedLocation ? { resolvedLocation } : {}),
        workspaceId,
      });
      if (result.status !== 'refreshed') {
        addToast(messages.failedToRefreshSessionMessages, 'error');
        return;
      }

      if (result.codingSession) {
        const synchronizedProject = await projectService.getProjectById(result.projectId).catch(
          (error) => {
            console.error(
              `Failed to resolve synchronized project "${result.projectId}" after manual session refresh`,
              error,
            );
            return null;
          },
        );

        if (synchronizedProject) {
          upsertProjectIntoProjectsStore(
            synchronizedProject.workspaceId,
            synchronizedProject,
            normalizedUserScope,
          );
        }
        upsertCodingSessionIntoProjectsStore(
          result.workspaceId?.trim() ||
            synchronizedProject?.workspaceId?.trim() ||
            workspaceId?.trim() ||
            result.codingSession.workspaceId,
          result.projectId,
          result.codingSession,
          normalizedUserScope,
        );
      }

      restoreSelectionAfterRefresh(
        preservedSelection.projectId,
        preservedSelection.codingSessionId,
      );
      addToast(messages.sessionMessagesRefreshed(codingSessionTitle), 'success');
    } catch (error) {
      console.error('Failed to refresh coding session messages', error);
      addToast(messages.failedToRefreshSessionMessages, 'error');
    } finally {
      setRefreshingCodingSessionScope(null);
    }
  }, [
    addToast,
    coreReadService,
    getPreservedSelection,
    messages,
    normalizedUserScope,
    projectService,
    resolveCodingSessionLocation,
    resolveCodingSessionTitle,
    restoreSelectionAfterRefresh,
    workspaceId,
  ]);

  return {
    handleRefreshCodingSessionMessages,
    handleRefreshProjectSessions,
    refreshingCodingSessionId: refreshingCodingSessionScope?.codingSessionId ?? null,
    refreshingCodingSessionProjectId: refreshingCodingSessionScope?.projectId ?? null,
    refreshingProjectId,
  };
}
