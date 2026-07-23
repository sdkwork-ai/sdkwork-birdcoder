import { useCallback, useRef, useState } from 'react';
import type { AgentSessionView, AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import { useAuth } from '../context/AuthContext.ts';
import {
  upsertAgentSessionIntoProjectsStore,
  upsertProjectIntoProjectsStore,
} from '../stores/projectsStore.ts';
import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import {
  refreshAgentSessionItems,
  refreshProjectSessions,
} from '../workbench/sessionRefresh.ts';

type ToastTone = 'error' | 'success';

interface SessionRefreshAgentSessionLocation {
  agentSession: AgentSessionView;
  project: AgentProjectView;
}

interface PreservedSessionRefreshSelection {
  agentSessionId: string | null;
  projectId: string;
}

interface SessionRefreshMessages {
  failedToRefreshProjectSessions: string;
  failedToRefreshSessionMessages: string;
  projectSessionsRefreshed: (projectName: string) => string;
  sessionMessagesRefreshed: (agentSessionTitle: string) => string;
}

export interface UseSessionRefreshActionsOptions {
  addToast: (message: string, tone: ToastTone) => void;
  agentSessionService: IAgentSessionService;
  getPreservedSelection: () => PreservedSessionRefreshSelection;
  messages: SessionRefreshMessages;
  projectService: IProjectService;
  resolveAgentSessionLocation?: (
    agentSessionId: string,
    projectId?: string | null,
  ) => SessionRefreshAgentSessionLocation | null;
  resolveAgentSessionTitle: (agentSessionId: string, projectId?: string | null) => string;
  resolveProjectName: (projectId: string) => string;
  restoreSelectionAfterRefresh: (
    projectId: string,
    agentSessionId: string | null,
  ) => void;
}

export function useSessionRefreshActions({
  addToast,
  agentSessionService,
  getPreservedSelection,
  messages,
  projectService,
  resolveAgentSessionLocation,
  resolveAgentSessionTitle,
  resolveProjectName,
  restoreSelectionAfterRefresh,
}: UseSessionRefreshActionsOptions) {
  const { user } = useAuth();
  const normalizedUserScope = user?.id?.trim() ?? 'anonymous';
  const [refreshingProjectId, setRefreshingProjectId] = useState<string | null>(null);
  const [refreshingAgentSessionScope, setRefreshingAgentSessionScope] = useState<{
    agentSessionId: string;
    projectId: string | null;
  } | null>(null);
  const projectRefreshGenerationRef = useRef(0);
  const agentSessionRefreshGenerationRef = useRef(0);

  const isPreservedSelectionStillCurrent = useCallback(
    (preservedSelection: PreservedSessionRefreshSelection) => {
      const currentSelection = getPreservedSelection();
      return (
        currentSelection.projectId === preservedSelection.projectId &&
        currentSelection.agentSessionId === preservedSelection.agentSessionId
      );
    },
    [getPreservedSelection],
  );

  const handleRefreshProjectSessions = useCallback(async (targetProjectId: string) => {
    const preservedSelection = getPreservedSelection();
    const projectName = resolveProjectName(targetProjectId);
    const requestGeneration = ++projectRefreshGenerationRef.current;

    setRefreshingProjectId(targetProjectId);
    try {
      const result = await refreshProjectSessions({
        agentSessionService,
        projectId: targetProjectId,
        projectService,
      });
      if (projectRefreshGenerationRef.current !== requestGeneration) {
        return;
      }
      if (result.status !== 'refreshed') {
        addToast(messages.failedToRefreshProjectSessions, 'error');
        return;
      }

      for (const project of result.projects ?? []) {
        upsertProjectIntoProjectsStore(project, normalizedUserScope);
      }
      if (isPreservedSelectionStillCurrent(preservedSelection)) {
        restoreSelectionAfterRefresh(
          preservedSelection.projectId,
          preservedSelection.agentSessionId,
        );
      }
      addToast(messages.projectSessionsRefreshed(projectName), 'success');
    } catch (error) {
      if (projectRefreshGenerationRef.current !== requestGeneration) {
        return;
      }
      console.error('Failed to refresh project sessions', error);
      addToast(messages.failedToRefreshProjectSessions, 'error');
    } finally {
      if (projectRefreshGenerationRef.current === requestGeneration) {
        setRefreshingProjectId(null);
      }
    }
  }, [
    addToast,
    agentSessionService,
    getPreservedSelection,
    messages,
    projectService,
    resolveProjectName,
    restoreSelectionAfterRefresh,
    isPreservedSelectionStillCurrent,
  ]);

  const handleRefreshAgentSessionItems = useCallback(async (
    agentSessionId: string,
    projectId?: string | null,
  ) => {
    const normalizedProjectId = projectId?.trim() ?? '';
    const preservedSelection = getPreservedSelection();
    const agentSessionTitle = resolveAgentSessionTitle(agentSessionId, normalizedProjectId);
    const resolvedLocation = normalizedProjectId
      ? resolveAgentSessionLocation?.(agentSessionId, normalizedProjectId) ?? null
      : null;
    if (normalizedProjectId && !resolvedLocation) {
      addToast(messages.failedToRefreshSessionMessages, 'error');
      return;
    }

    const requestGeneration = ++agentSessionRefreshGenerationRef.current;

    setRefreshingAgentSessionScope({
      agentSessionId,
      projectId: normalizedProjectId || null,
    });
    try {
      const result = await refreshAgentSessionItems({
        agentSessionService,
        agentSessionId,
        ...(resolvedLocation ? { resolvedLocation } : {}),
      });
      if (agentSessionRefreshGenerationRef.current !== requestGeneration) {
        return;
      }
      if (result.status !== 'refreshed') {
        addToast(messages.failedToRefreshSessionMessages, 'error');
        return;
      }

      if (result.agentSession) {
        const synchronizedProject = await projectService.getProjectById(result.projectId).catch(
          (error) => {
            console.error(
              `Failed to resolve synchronized project "${result.projectId}" after manual session refresh`,
              error,
            );
            return null;
          },
        );
        if (agentSessionRefreshGenerationRef.current !== requestGeneration) {
          return;
        }

        if (synchronizedProject) {
          upsertProjectIntoProjectsStore(synchronizedProject, normalizedUserScope);
        }
        upsertAgentSessionIntoProjectsStore(
          result.projectId,
          result.agentSession,
          normalizedUserScope,
        );
      }

      if (isPreservedSelectionStillCurrent(preservedSelection)) {
        restoreSelectionAfterRefresh(
          preservedSelection.projectId,
          preservedSelection.agentSessionId,
        );
      }
      addToast(messages.sessionMessagesRefreshed(agentSessionTitle), 'success');
    } catch (error) {
      if (agentSessionRefreshGenerationRef.current !== requestGeneration) {
        return;
      }
      console.error('Failed to refresh coding session messages', error);
      addToast(messages.failedToRefreshSessionMessages, 'error');
    } finally {
      if (agentSessionRefreshGenerationRef.current === requestGeneration) {
        setRefreshingAgentSessionScope(null);
      }
    }
  }, [
    addToast,
    agentSessionService,
    getPreservedSelection,
    messages,
    projectService,
    resolveAgentSessionLocation,
    resolveAgentSessionTitle,
    restoreSelectionAfterRefresh,
    isPreservedSelectionStillCurrent,
  ]);

  return {
    handleRefreshAgentSessionItems,
    handleRefreshProjectSessions,
    refreshingAgentSessionId: refreshingAgentSessionScope?.agentSessionId ?? null,
    refreshingAgentSessionProjectId: refreshingAgentSessionScope?.projectId ?? null,
    refreshingProjectId,
  };
}
