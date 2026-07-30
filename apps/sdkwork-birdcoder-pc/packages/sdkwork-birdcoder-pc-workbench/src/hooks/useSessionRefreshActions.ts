import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AgentSessionView, AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import { useAuth } from '../context/AuthContext.ts';
import { buildBirdCoderAuthSessionInventoryScope } from '../context/authSessionScope.ts';
import {
  buildProjectsStoreScopeKey,
  getAgentSessionTranscriptRevision,
  upsertAgentSessionIntoProjectsStore,
  upsertAgentSessionIntoProjectsStoreIfTranscriptUnchanged,
} from '../stores/projectsStore.ts';
import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import type { ImportedProjectSessionInventoryResult } from '../workbench/importedProjectHydration.ts';
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

interface ActiveAgentSessionRefreshRequest {
  controller: AbortController;
  generation: number;
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

interface ScopedEarlierAgentSessionItemsErrorState
  extends ScopedEarlierAgentSessionItemsState {
  message: string;
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
  refreshProjectSessionInventory: (
    projectId: string,
    force?: boolean,
  ) => Promise<ImportedProjectSessionInventoryResult | null>;
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
  refreshProjectSessionInventory,
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
  const [earlierAgentSessionItemsErrorScope, setEarlierAgentSessionItemsErrorScope] =
    useState<ScopedEarlierAgentSessionItemsErrorState | null>(null);
  const projectRefreshGenerationRef = useRef(0);
  const agentSessionRefreshGenerationRef = useRef(0);
  const activeAgentSessionRefreshRequestRef =
    useRef<ActiveAgentSessionRefreshRequest | null>(null);
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
    setLoadingEarlierAgentSessionScope(null);
    setEarlierAgentSessionItemsErrorScope(null);
  }, []);

  const cancelActiveAgentSessionRefreshRequest = useCallback(() => {
    const activeRequest = activeAgentSessionRefreshRequestRef.current;
    if (!activeRequest) {
      return;
    }
    activeAgentSessionRefreshRequestRef.current = null;
    agentSessionRefreshGenerationRef.current += 1;
    activeRequest.controller.abort(new DOMException(
      'Agents session refresh request was superseded.',
      'AbortError',
    ));
    setRefreshingAgentSessionScope(null);
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
      cancelActiveAgentSessionRefreshRequest();
      cancelActiveEarlierItemsRequest();
    };
  }, [cancelActiveAgentSessionRefreshRequest, cancelActiveEarlierItemsRequest, userScope]);

  useEffect(() => () => {
    cancelActiveAgentSessionRefreshRequest();
    cancelActiveEarlierItemsRequest();
  }, [
    cancelActiveAgentSessionRefreshRequest,
    cancelActiveEarlierItemsRequest,
    selectedAgentSessionId,
    selectedProjectId,
  ]);

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
      const result = await refreshProjectSessionInventory(targetProjectId, true);
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
    refreshProjectSessionInventory,
    userScope,
  ]);

  const handleRefreshAgentSessionItems = useCallback(async (
    agentSessionId: string,
    projectId?: string | null,
  ) => {
    if (activeUserScopeRef.current !== userScope) {
      return;
    }
    const normalizedAgentSessionId = agentSessionId.trim();
    if (!normalizedAgentSessionId) {
      addToast(messages.failedToRefreshSessionMessages, 'error');
      return;
    }
    const preservedSelection = getPreservedSelectionRef.current();
    const requestedProjectId = projectId?.trim() ?? '';
    const selectedProjectId =
      preservedSelection.agentSessionId?.trim() === normalizedAgentSessionId
        ? preservedSelection.projectId.trim()
        : '';
    const locationProjectId = requestedProjectId || selectedProjectId;
    if (!locationProjectId) {
      addToast(messages.failedToRefreshSessionMessages, 'error');
      return;
    }
    const resolvedLocation = resolveAgentSessionLocation?.(
      normalizedAgentSessionId,
      locationProjectId,
    ) ?? null;
    const normalizedProjectId = locationProjectId;
    if (
      !resolvedLocation
      || !normalizedProjectId
      || resolvedLocation.project.projectId.trim() !== normalizedProjectId
      || resolvedLocation.agentSession.id.trim() !== normalizedAgentSessionId
    ) {
      addToast(messages.failedToRefreshSessionMessages, 'error');
      return;
    }
    const agentSessionTitle = resolveAgentSessionTitle(
      normalizedAgentSessionId,
      normalizedProjectId,
    );

    cancelActiveAgentSessionRefreshRequest();
    const requestGeneration = ++agentSessionRefreshGenerationRef.current;
    const controller = new AbortController();
    activeAgentSessionRefreshRequestRef.current = {
      controller,
      generation: requestGeneration,
    };

    setRefreshingAgentSessionScope({
      agentSessionId,
      projectId: normalizedProjectId || null,
      userScope,
    });
    try {
      const result = await refreshAgentSessionItems({
        agentSessionService,
        agentSessionId: normalizedAgentSessionId,
        signal: controller.signal,
        resolvedLocation,
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

        const workspaceId =
          synchronizedProject?.workspaceId ?? resolvedLocation.project.workspaceId;
        if (workspaceId) {
          upsertAgentSessionIntoProjectsStore(
            result.projectId,
            result.agentSession,
            workspaceId,
            userScope,
            {
              itemMergeMode: result.replaceLoadedAuthorityWindow
                ? 'authority-window-reset'
                : 'latest',
              projectMetadata: synchronizedProject ?? resolvedLocation.project,
            },
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
      if (controller.signal.aborted || isAbortError(error)) {
        return;
      }
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
      if (
        activeAgentSessionRefreshRequestRef.current?.controller === controller
        && activeAgentSessionRefreshRequestRef.current.generation === requestGeneration
      ) {
        activeAgentSessionRefreshRequestRef.current = null;
      }
    }
  }, [
    addToast,
    agentSessionService,
    cancelActiveAgentSessionRefreshRequest,
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
    setEarlierAgentSessionItemsErrorScope(null);
    const activeRequest = activeEarlierItemsRequestRef.current;
    if (activeRequest?.scopeKey === scopeKey) {
      return activeRequest.promise;
    }
    cancelActiveEarlierItemsRequest();

    const resolvedLocation = resolveAgentSessionLocation?.(
      normalizedAgentSessionId,
      normalizedProjectId,
    ) ?? null;
    if (
      !resolvedLocation?.agentSession.itemPageInfo?.hasMore
      || resolvedLocation.agentSession.itemPageInfo.retentionLimitReached === true
    ) {
      return Promise.resolve();
    }
    const expectedTranscript = {
      agentId: resolvedLocation.agentSession.agentId,
      hasMore: resolvedLocation.agentSession.itemPageInfo.hasMore,
      nextCursor: resolvedLocation.agentSession.itemPageInfo.nextCursor,
      pageSize: resolvedLocation.agentSession.itemPageInfo.pageSize,
      revision: getAgentSessionTranscriptRevision(
        buildProjectsStoreScopeKey(userScope, resolvedLocation.project.workspaceId),
        normalizedProjectId,
        normalizedAgentSessionId,
      ),
    };

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
          upsertAgentSessionIntoProjectsStoreIfTranscriptUnchanged(
            result.projectId,
            result.agentSession,
            resolvedLocation.project.workspaceId,
            userScope,
            expectedTranscript,
            { itemMergeMode: 'ordered-window' },
          );
        }
        setEarlierAgentSessionItemsErrorScope(null);
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          return;
        }
        console.error('Failed to load earlier coding session messages', error);
        const latestSelection = getPreservedSelectionRef.current();
        if (
          activeUserScopeRef.current === userScope
          && latestSelection.agentSessionId?.trim() === normalizedAgentSessionId
          && latestSelection.projectId.trim() === normalizedProjectId
        ) {
          setEarlierAgentSessionItemsErrorScope({
            agentSessionId: normalizedAgentSessionId,
            message: messages.failedToRefreshSessionMessages,
            projectId: normalizedProjectId,
            userScope,
          });
        }
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
    cancelActiveEarlierItemsRequest,
    messages.failedToRefreshSessionMessages,
    resolveAgentSessionLocation,
    userScope,
  ]);

  const isRefreshingCurrentUserScope = refreshingAgentSessionScope?.userScope === userScope;
  const isLoadingEarlierForCurrentSelection =
    loadingEarlierAgentSessionScope?.userScope === userScope
    && loadingEarlierAgentSessionScope.agentSessionId === selectedAgentSessionId
    && loadingEarlierAgentSessionScope.projectId === selectedProjectId;
  const hasEarlierItemsErrorForCurrentSelection =
    earlierAgentSessionItemsErrorScope?.userScope === userScope
    && earlierAgentSessionItemsErrorScope.agentSessionId === selectedAgentSessionId
    && earlierAgentSessionItemsErrorScope.projectId === selectedProjectId;

  return {
    earlierAgentSessionItemsError:
      hasEarlierItemsErrorForCurrentSelection
        ? earlierAgentSessionItemsErrorScope.message
        : null,
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
