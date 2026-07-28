import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AgentSessionView, AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import { useAuth } from '../context/AuthContext.ts';
import { buildBirdCoderAuthSessionInventoryScope } from '../context/authSessionScope.ts';
import {
  upsertAgentSessionIntoProjectsStore,
  upsertProjectIntoProjectsStore,
} from '../stores/projectsStore.ts';
import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import type { HydrateImportedProjectFromAuthorityResult } from '../workbench/importedProjectHydration.ts';
import {
  loadEarlierAgentSessionItems,
  refreshAgentSessionItems,
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

interface ActiveEarlierItemsRequest {
  controller: AbortController;
  promise: Promise<void>;
  scopeKey: string;
}

interface ScopedProjectRefreshState {
  projectId: string;
  userScope: string;
}

interface ScopedAgentSessionRefreshState {
  agentSessionId: string;
  projectId: string | null;
  userScope: string;
}

interface ScopedEarlierAgentSessionItemsState {
  agentSessionId: string;
  projectId: string;
  userScope: string;
}

function isAbortError(error: unknown): boolean {
  return (error instanceof DOMException || error instanceof Error) && error.name === 'AbortError';
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
  synchronizeProjectSessions: (
    projectId: string,
    force?: boolean,
  ) => Promise<HydrateImportedProjectFromAuthorityResult | null>;
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
  synchronizeProjectSessions,
}: UseSessionRefreshActionsOptions) {
  const { sessionRevision, user } = useAuth();
  const userScope = buildBirdCoderAuthSessionInventoryScope(user?.id, sessionRevision);
  const getPreservedSelectionRef = useRef(getPreservedSelection);
  const restoreSelectionAfterRefreshRef = useRef(restoreSelectionAfterRefresh);
  const activeUserScopeRef = useRef<string | null>(userScope);
  const [refreshingProjectScope, setRefreshingProjectScope] =
    useState<ScopedProjectRefreshState | null>(null);
  const [refreshingAgentSessionScope, setRefreshingAgentSessionScope] =
    useState<ScopedAgentSessionRefreshState | null>(null);
  const [loadingEarlierAgentSessionScope, setLoadingEarlierAgentSessionScope] =
    useState<ScopedEarlierAgentSessionItemsState | null>(null);
  const projectRefreshGenerationRef = useRef(0);
  const agentSessionRefreshGenerationRef = useRef(0);
  const activeEarlierItemsRequestRef = useRef<ActiveEarlierItemsRequest | null>(null);
  const currentSelection = getPreservedSelection();
  const selectedAgentSessionId = currentSelection.agentSessionId?.trim() ?? '';
  const selectedProjectId = currentSelection.projectId.trim();

  const cancelActiveEarlierItemsRequest = useCallback(() => {
    const activeRequest = activeEarlierItemsRequestRef.current;
    activeEarlierItemsRequestRef.current = null;
    activeRequest?.controller.abort(new DOMException(
      'Agents session history request was superseded.',
      'AbortError',
    ));
  }, []);

  useLayoutEffect(() => {
    getPreservedSelectionRef.current = getPreservedSelection;
    restoreSelectionAfterRefreshRef.current = restoreSelectionAfterRefresh;
  }, [getPreservedSelection, restoreSelectionAfterRefresh]);

  useLayoutEffect(() => {
    activeUserScopeRef.current = userScope;
    return () => {
      activeUserScopeRef.current = null;
      projectRefreshGenerationRef.current += 1;
      agentSessionRefreshGenerationRef.current += 1;
      cancelActiveEarlierItemsRequest();
    };
  }, [cancelActiveEarlierItemsRequest, userScope]);

  useEffect(() => () => {
    cancelActiveEarlierItemsRequest();
  }, [cancelActiveEarlierItemsRequest, selectedAgentSessionId, selectedProjectId]);

  const isPreservedSelectionStillCurrent = useCallback(
    (preservedSelection: PreservedSessionRefreshSelection) => {
      const currentSelection = getPreservedSelectionRef.current();
      return (
        currentSelection.projectId === preservedSelection.projectId &&
        currentSelection.agentSessionId === preservedSelection.agentSessionId
      );
    },
    [],
  );

  const handleRefreshProjectSessions = useCallback(async (targetProjectId: string) => {
    if (activeUserScopeRef.current !== userScope) {
      return;
    }
    const preservedSelection = getPreservedSelectionRef.current();
    const projectName = resolveProjectName(targetProjectId);
    const requestGeneration = ++projectRefreshGenerationRef.current;

    setRefreshingProjectScope({ projectId: targetProjectId, userScope });
    try {
      const result = await synchronizeProjectSessions(targetProjectId, true);
      if (
        projectRefreshGenerationRef.current !== requestGeneration
        || activeUserScopeRef.current !== userScope
      ) {
        return;
      }
      if (!result) {
        return;
      }
      if (isPreservedSelectionStillCurrent(preservedSelection)) {
        restoreSelectionAfterRefreshRef.current(
          preservedSelection.projectId,
          preservedSelection.agentSessionId,
        );
      }
      addToast(messages.projectSessionsRefreshed(projectName), 'success');
    } catch (error) {
      if (
        projectRefreshGenerationRef.current !== requestGeneration
        || activeUserScopeRef.current !== userScope
      ) {
        return;
      }
      console.error('Failed to refresh project sessions', error);
      addToast(messages.failedToRefreshProjectSessions, 'error');
    } finally {
      if (
        projectRefreshGenerationRef.current === requestGeneration
        && activeUserScopeRef.current === userScope
      ) {
        setRefreshingProjectScope(null);
      }
    }
  }, [
    addToast,
    messages,
    resolveProjectName,
    isPreservedSelectionStillCurrent,
    synchronizeProjectSessions,
    userScope,
  ]);

  const handleRefreshAgentSessionItems = useCallback(async (
    agentSessionId: string,
    projectId?: string | null,
  ) => {
    if (activeUserScopeRef.current !== userScope) {
      return;
    }
    const normalizedProjectId = projectId?.trim() ?? '';
    const preservedSelection = getPreservedSelectionRef.current();
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
      userScope,
    });
    try {
      const result = await refreshAgentSessionItems({
        agentSessionService,
        agentSessionId,
        ...(resolvedLocation ? { resolvedLocation } : {}),
      });
      if (
        agentSessionRefreshGenerationRef.current !== requestGeneration
        || activeUserScopeRef.current !== userScope
      ) {
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
        if (
          agentSessionRefreshGenerationRef.current !== requestGeneration
          || activeUserScopeRef.current !== userScope
        ) {
          return;
        }

        if (synchronizedProject) {
          upsertProjectIntoProjectsStore(synchronizedProject, userScope);
        }
        const workspaceId =
          synchronizedProject?.workspaceId ?? resolvedLocation?.project.workspaceId ?? '';
        if (workspaceId) {
          upsertAgentSessionIntoProjectsStore(
            result.projectId,
            result.agentSession,
            workspaceId,
            userScope,
          );
        }
      }

      if (isPreservedSelectionStillCurrent(preservedSelection)) {
        restoreSelectionAfterRefreshRef.current(
          preservedSelection.projectId,
          preservedSelection.agentSessionId,
        );
      }
      addToast(messages.sessionMessagesRefreshed(agentSessionTitle), 'success');
    } catch (error) {
      if (
        agentSessionRefreshGenerationRef.current !== requestGeneration
        || activeUserScopeRef.current !== userScope
      ) {
        return;
      }
      console.error('Failed to refresh coding session messages', error);
      addToast(messages.failedToRefreshSessionMessages, 'error');
    } finally {
      if (
        agentSessionRefreshGenerationRef.current === requestGeneration
        && activeUserScopeRef.current === userScope
      ) {
        setRefreshingAgentSessionScope(null);
      }
    }
  }, [
    addToast,
    agentSessionService,
    messages,
    projectService,
    resolveAgentSessionLocation,
    resolveAgentSessionTitle,
    isPreservedSelectionStillCurrent,
    userScope,
  ]);

  const handleLoadEarlierAgentSessionItems = useCallback((
    agentSessionId: string,
    projectId?: string | null,
  ): Promise<void> => {
    if (activeUserScopeRef.current !== userScope) {
      return Promise.resolve();
    }
    const normalizedAgentSessionId = agentSessionId.trim();
    const normalizedProjectId = projectId?.trim() ?? '';
    if (!normalizedAgentSessionId || !normalizedProjectId) {
      return Promise.resolve();
    }

    const scopeKey = `${userScope}\u0001${normalizedProjectId}\u0001${normalizedAgentSessionId}`;
    const activeRequest = activeEarlierItemsRequestRef.current;
    if (activeRequest?.scopeKey === scopeKey) {
      return activeRequest.promise;
    }
    activeRequest?.controller.abort(new DOMException(
      'Agents session history request was superseded.',
      'AbortError',
    ));

    const resolvedLocation = resolveAgentSessionLocation?.(
      normalizedAgentSessionId,
      normalizedProjectId,
    ) ?? null;
    if (!resolvedLocation?.agentSession.itemPageInfo?.hasMore) {
      return Promise.resolve();
    }

    const controller = new AbortController();
    setLoadingEarlierAgentSessionScope({
      agentSessionId: normalizedAgentSessionId,
      projectId: normalizedProjectId,
      userScope,
    });
    const promise = (async () => {
      try {
        const result = await loadEarlierAgentSessionItems({
          agentSession: resolvedLocation.agentSession,
          agentSessionService,
          signal: controller.signal,
        });
        controller.signal.throwIfAborted();
        if (activeUserScopeRef.current !== userScope) {
          return;
        }
        const latestSelection = getPreservedSelectionRef.current();
        if (
          latestSelection.agentSessionId?.trim() !== normalizedAgentSessionId ||
          latestSelection.projectId.trim() !== normalizedProjectId
        ) {
          return;
        }
        if (result.status === 'loaded') {
          upsertAgentSessionIntoProjectsStore(
            result.projectId,
            result.agentSession,
            resolvedLocation.project.workspaceId,
            userScope,
          );
        }
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          return;
        }
        console.error('Failed to load earlier coding session messages', error);
        addToast(messages.failedToRefreshSessionMessages, 'error');
      } finally {
        if (activeEarlierItemsRequestRef.current?.controller === controller) {
          activeEarlierItemsRequestRef.current = null;
          setLoadingEarlierAgentSessionScope(null);
        }
      }
    })();
    activeEarlierItemsRequestRef.current = { controller, promise, scopeKey };
    return promise;
  }, [
    addToast,
    agentSessionService,
    messages.failedToRefreshSessionMessages,
    resolveAgentSessionLocation,
    userScope,
  ]);

  const isRefreshingCurrentUserScope = refreshingAgentSessionScope?.userScope === userScope;
  const isLoadingEarlierForCurrentSelection =
    loadingEarlierAgentSessionScope?.userScope === userScope
    && loadingEarlierAgentSessionScope.agentSessionId === selectedAgentSessionId
    && loadingEarlierAgentSessionScope.projectId === selectedProjectId;

  return {
    handleLoadEarlierAgentSessionItems,
    handleRefreshAgentSessionItems,
    handleRefreshProjectSessions,
    loadingEarlierAgentSessionId:
      isLoadingEarlierForCurrentSelection ? loadingEarlierAgentSessionScope.agentSessionId : null,
    loadingEarlierAgentSessionProjectId:
      isLoadingEarlierForCurrentSelection ? loadingEarlierAgentSessionScope.projectId : null,
    refreshingAgentSessionId:
      isRefreshingCurrentUserScope ? refreshingAgentSessionScope.agentSessionId : null,
    refreshingAgentSessionProjectId:
      isRefreshingCurrentUserScope ? refreshingAgentSessionScope.projectId : null,
    refreshingProjectId:
      refreshingProjectScope?.userScope === userScope ? refreshingProjectScope.projectId : null,
  };
}
