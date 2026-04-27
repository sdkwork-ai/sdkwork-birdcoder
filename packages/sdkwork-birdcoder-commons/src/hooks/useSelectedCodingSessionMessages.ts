import { useEffect, useRef, useState } from 'react';
import {
  buildBirdCoderSessionSynchronizationVersion,
  isBirdCoderCodingSessionExecuting,
  resolveBirdCoderSessionActivityTimestamp,
  type BirdCoderCodingSession,
  type BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import { useAuth } from '../context/AuthContext.ts';
import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import {
  upsertCodingSessionIntoProjectsStore,
  upsertProjectIntoProjectsStore,
} from '../stores/projectsStore.ts';
import { refreshCodingSessionMessages } from '../workbench/sessionRefresh.ts';

type SelectedCodingSessionMessagesCoreReadService = NonNullable<
  Parameters<typeof refreshCodingSessionMessages>[0]['coreReadService']
>;

export interface UseSelectedCodingSessionMessagesOptions {
  coreReadService?: SelectedCodingSessionMessagesCoreReadService;
  isActive?: boolean;
  projectService: IProjectService;
  selectionRefreshToken: number;
  selectedCodingSession?: BirdCoderCodingSession | null;
  selectedCodingSessionId?: string | null;
  selectedProject?: BirdCoderProject | null;
  workspaceId?: string;
}

function buildSynchronizationVersion(
  codingSession: BirdCoderCodingSession,
  messageCount: number = codingSession.messages.length,
): string {
  return buildBirdCoderSessionSynchronizationVersion(codingSession, messageCount);
}

function normalizeSelectionScopePart(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function buildSynchronizationScopeKey(
  userScope: string,
  codingSessionId: string,
  selectedCodingSession: BirdCoderCodingSession | null | undefined,
  selectedProject: BirdCoderProject | null | undefined,
  workspaceId: string | undefined,
): string {
  const normalizedUserScope = normalizeSelectionScopePart(userScope) || 'anonymous';
  const normalizedCodingSessionId = normalizeSelectionScopePart(codingSessionId);
  const normalizedWorkspaceId =
    normalizeSelectionScopePart(selectedProject?.workspaceId) ||
    normalizeSelectionScopePart(selectedCodingSession?.workspaceId) ||
    normalizeSelectionScopePart(workspaceId);
  const normalizedProjectId =
    normalizeSelectionScopePart(selectedProject?.id) ||
    normalizeSelectionScopePart(selectedCodingSession?.projectId);

  return [
    normalizedUserScope,
    normalizedWorkspaceId || 'workspace:unknown',
    normalizedProjectId || 'project:unknown',
    normalizedCodingSessionId,
  ].join('::');
}

const synchronizedSessionVersionsByScopeKey = new Map<string, string>();
const attemptedSessionVersionsByScopeKey = new Map<string, string>();
const processedSelectionRefreshKeyByScopeKey = new Map<string, string>();
const MAX_TRACKED_SYNCHRONIZATION_SCOPES = 512;
const EXECUTING_SESSION_FRESH_REFRESH_INTERVAL_MS = 400;
const EXECUTING_SESSION_RECENT_REFRESH_INTERVAL_MS = 900;
const EXECUTING_SESSION_STALE_REFRESH_INTERVAL_MS = 1600;
const EXECUTING_SESSION_FRESH_ACTIVITY_WINDOW_MS = 2_500;
const EXECUTING_SESSION_RECENT_ACTIVITY_WINDOW_MS = 8_000;
const EXECUTING_SESSION_REFRESH_SETTLE_WINDOW_MS = 15_000;
const SELECTED_SESSION_IDLE_EXTERNAL_REFRESH_INTERVAL_MS = 5000;

function isReplyMessageRole(role: BirdCoderCodingSession['messages'][number]['role']): boolean {
  return (
    role === 'assistant' ||
    role === 'planner' ||
    role === 'reviewer' ||
    role === 'tool'
  );
}

function hasPendingVisibleReply(
  codingSession: BirdCoderCodingSession | null | undefined,
): boolean {
  if (!codingSession || codingSession.messages.length === 0) {
    return false;
  }

  for (let index = codingSession.messages.length - 1; index >= 0; index -= 1) {
    const message = codingSession.messages[index];
    if (message.role !== 'user') {
      continue;
    }

    return !codingSession.messages
      .slice(index + 1)
      .some((candidate) => isReplyMessageRole(candidate.role));
  }

  return false;
}

function resolveSelectedCodingSessionExecutionRefreshDelay(
  codingSession: BirdCoderCodingSession | null | undefined,
): number {
  const activityTimestamp = resolveBirdCoderSessionActivityTimestamp(codingSession ?? {});
  const parsedActivityTimestamp =
    typeof activityTimestamp === 'string' ? Date.parse(activityTimestamp) : Number.NaN;
  if (Number.isNaN(parsedActivityTimestamp)) {
    return EXECUTING_SESSION_STALE_REFRESH_INTERVAL_MS;
  }

  const activityAgeMs = Math.max(0, Date.now() - parsedActivityTimestamp);
  if (activityAgeMs <= EXECUTING_SESSION_FRESH_ACTIVITY_WINDOW_MS) {
    return EXECUTING_SESSION_FRESH_REFRESH_INTERVAL_MS;
  }
  if (activityAgeMs <= EXECUTING_SESSION_RECENT_ACTIVITY_WINDOW_MS) {
    return EXECUTING_SESSION_RECENT_REFRESH_INTERVAL_MS;
  }

  return EXECUTING_SESSION_STALE_REFRESH_INTERVAL_MS;
}

function setTrackedScopeValue(
  trackedValues: Map<string, string>,
  scopeKey: string,
  value: string,
): void {
  trackedValues.delete(scopeKey);
  trackedValues.set(scopeKey, value);

  while (trackedValues.size > MAX_TRACKED_SYNCHRONIZATION_SCOPES) {
    const oldestKey = trackedValues.keys().next().value;
    if (typeof oldestKey !== 'string') {
      break;
    }
    trackedValues.delete(oldestKey);
  }
}

export function useSelectedCodingSessionMessages({
  coreReadService,
  isActive = true,
  projectService,
  selectionRefreshToken,
  selectedCodingSession,
  selectedCodingSessionId,
  selectedProject,
  workspaceId,
}: UseSelectedCodingSessionMessagesOptions): boolean {
  const { user } = useAuth();
  const activeSynchronizationCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const pendingExecutionRefreshUntilRef = useRef(0);
  const [isSelectedCodingSessionMessagesLoading, setIsSelectedCodingSessionMessagesLoading] = useState(false);
  const [executionRefreshTick, setExecutionRefreshTick] = useState(0);
  const normalizedUserScope = user?.id?.trim() ?? 'anonymous';
  const normalizedCodingSessionId = selectedCodingSessionId?.trim() ?? '';
  const normalizedSelectedProjectId = selectedProject?.id?.trim() ?? '';
  const normalizedSelectedProjectWorkspaceId = selectedProject?.workspaceId?.trim() ?? '';
  const normalizedSelectedCodingSessionProjectId = selectedCodingSession?.projectId?.trim() ?? '';
  const normalizedSelectedCodingSessionWorkspaceId =
    selectedCodingSession?.workspaceId?.trim() ?? '';
  const selectedCodingSessionSynchronizationVersion =
    selectedCodingSession?.id === normalizedCodingSessionId
      ? buildSynchronizationVersion(selectedCodingSession)
      : '';
  const isSelectedCodingSessionExecuting =
    selectedCodingSession?.id === normalizedCodingSessionId &&
    isBirdCoderCodingSessionExecuting(selectedCodingSession);
  const hasSelectedCodingSessionPendingReply =
    selectedCodingSession?.id === normalizedCodingSessionId &&
    hasPendingVisibleReply(selectedCodingSession);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!normalizedCodingSessionId) {
      pendingExecutionRefreshUntilRef.current = 0;
      return;
    }

    pendingExecutionRefreshUntilRef.current = Date.now() + EXECUTING_SESSION_REFRESH_SETTLE_WINDOW_MS;
  }, [normalizedCodingSessionId, selectionRefreshToken]);

  useEffect(() => {
    if (!normalizedCodingSessionId) {
      pendingExecutionRefreshUntilRef.current = 0;
      return;
    }

    if (!hasSelectedCodingSessionPendingReply) {
      pendingExecutionRefreshUntilRef.current = 0;
      return;
    }

    if (isSelectedCodingSessionExecuting) {
      pendingExecutionRefreshUntilRef.current =
        Date.now() + EXECUTING_SESSION_REFRESH_SETTLE_WINDOW_MS;
    }
  }, [
    hasSelectedCodingSessionPendingReply,
    isSelectedCodingSessionExecuting,
    normalizedCodingSessionId,
    selectedCodingSessionSynchronizationVersion,
  ]);

  useEffect(() => {
    const shouldContinuePollingAfterCompletion =
      hasSelectedCodingSessionPendingReply &&
      pendingExecutionRefreshUntilRef.current > Date.now();
    const shouldUseExecutingSessionRefresh =
      isSelectedCodingSessionExecuting || shouldContinuePollingAfterCompletion;
    if (
      !isActive ||
      !coreReadService ||
      isSelectedCodingSessionMessagesLoading ||
      !normalizedCodingSessionId
    ) {
      return;
    }

    const executionRefreshDelay = shouldUseExecutingSessionRefresh
      ? resolveSelectedCodingSessionExecutionRefreshDelay(
          selectedCodingSession,
        )
      : SELECTED_SESSION_IDLE_EXTERNAL_REFRESH_INTERVAL_MS;
    const refreshTimer = window.setTimeout(() => {
      setExecutionRefreshTick((previousState) => previousState + 1);
    }, executionRefreshDelay);

    return () => {
      window.clearTimeout(refreshTimer);
    };
  }, [
    coreReadService,
    hasSelectedCodingSessionPendingReply,
    isActive,
    isSelectedCodingSessionMessagesLoading,
    isSelectedCodingSessionExecuting,
    normalizedCodingSessionId,
    selectedCodingSessionSynchronizationVersion,
  ]);

  useEffect(() => {
    if (!isActive || !normalizedCodingSessionId || !coreReadService) {
      activeSynchronizationCountRef.current = 0;
      setIsSelectedCodingSessionMessagesLoading((previousState) =>
        previousState ? false : previousState,
      );
      return;
    }

    const synchronizationScopeKey = buildSynchronizationScopeKey(
      normalizedUserScope,
      normalizedCodingSessionId,
      selectedCodingSession,
      selectedProject,
      workspaceId,
    );
    const selectionRefreshKey =
      `${synchronizationScopeKey}:${selectionRefreshToken}:${executionRefreshTick}`;
    if (
      processedSelectionRefreshKeyByScopeKey.get(synchronizationScopeKey) !== selectionRefreshKey
    ) {
      synchronizedSessionVersionsByScopeKey.delete(synchronizationScopeKey);
      attemptedSessionVersionsByScopeKey.delete(synchronizationScopeKey);
      setTrackedScopeValue(
        processedSelectionRefreshKeyByScopeKey,
        synchronizationScopeKey,
        selectionRefreshKey,
      );
    }

    const resolvedProject =
      selectedCodingSession && selectedProject?.id === selectedCodingSession.projectId
        ? selectedProject
        : null;
    const resolvedCodingSession =
      selectedCodingSession?.id === normalizedCodingSessionId ? selectedCodingSession : null;
    const shouldBootstrapFromAuthority = !resolvedProject || !resolvedCodingSession;

    const synchronizationVersion =
      resolvedCodingSession && resolvedProject
        ? buildSynchronizationVersion(resolvedCodingSession)
        : `bootstrap:${selectionRefreshKey}`;
    if (
      synchronizedSessionVersionsByScopeKey.get(synchronizationScopeKey) ===
      synchronizationVersion
    ) {
      return;
    }
    if (
      attemptedSessionVersionsByScopeKey.get(synchronizationScopeKey) ===
      synchronizationVersion
    ) {
      return;
    }

    setTrackedScopeValue(
      attemptedSessionVersionsByScopeKey,
      synchronizationScopeKey,
      synchronizationVersion,
    );
    activeSynchronizationCountRef.current += 1;
    setIsSelectedCodingSessionMessagesLoading((previousState) =>
      previousState ? previousState : true,
    );
    let isDisposed = false;

    const synchronizationTask = shouldBootstrapFromAuthority
        ? refreshCodingSessionMessages({
            codingSessionId: normalizedCodingSessionId,
            coreReadService,
            identityScope: normalizedUserScope,
            projectService,
            workspaceId,
          })
      : refreshCodingSessionMessages({
            codingSessionId: normalizedCodingSessionId,
            coreReadService,
            identityScope: normalizedUserScope,
            projectService,
            resolvedLocation: {
            codingSession: resolvedCodingSession,
            project: resolvedProject,
          },
          workspaceId: resolvedProject.workspaceId?.trim() || workspaceId,
        });

    void synchronizationTask
      .then(async (result) => {
        if (isDisposed) {
          attemptedSessionVersionsByScopeKey.delete(synchronizationScopeKey);
          return;
        }

        if (!result || result.status !== 'refreshed' || !result.codingSession) {
          attemptedSessionVersionsByScopeKey.delete(synchronizationScopeKey);
          return;
        }

        if (resolvedProject?.id === result.projectId) {
          upsertCodingSessionIntoProjectsStore(
            result.workspaceId ??
              resolvedProject.workspaceId ??
              result.codingSession.workspaceId,
            result.projectId,
            result.codingSession,
            normalizedUserScope,
          );
        } else {
          const synchronizedProject = await projectService.getProjectById(result.projectId).catch(
            (error) => {
              console.error(
                `Failed to resolve synchronized project "${result.projectId}" after message refresh`,
                error,
              );
              return null;
            },
          );
          if (isDisposed) {
            attemptedSessionVersionsByScopeKey.delete(synchronizationScopeKey);
            return;
          }

          if (synchronizedProject) {
            upsertProjectIntoProjectsStore(
              synchronizedProject.workspaceId,
              synchronizedProject,
              normalizedUserScope,
            );
          } else {
            upsertCodingSessionIntoProjectsStore(
              result.workspaceId ??
                resolvedProject?.workspaceId ??
                result.codingSession.workspaceId,
              result.projectId,
              result.codingSession,
              normalizedUserScope,
            );
          }
        }
        setTrackedScopeValue(
          synchronizedSessionVersionsByScopeKey,
          synchronizationScopeKey,
          result.synchronizationVersion ??
            buildSynchronizationVersion(result.codingSession, result.messageCount),
        );
      })
      .catch((error) => {
        attemptedSessionVersionsByScopeKey.delete(synchronizationScopeKey);
        console.error('Failed to synchronize selected coding session messages', error);
      })
      .finally(() => {
        activeSynchronizationCountRef.current = Math.max(
          0,
          activeSynchronizationCountRef.current - 1,
        );
        if (isMountedRef.current && activeSynchronizationCountRef.current === 0) {
          setIsSelectedCodingSessionMessagesLoading((previousState) =>
            previousState ? false : previousState,
          );
        }
      });

    return () => {
      isDisposed = true;
      attemptedSessionVersionsByScopeKey.delete(synchronizationScopeKey);
    };
  }, [
    coreReadService,
    projectService,
    selectionRefreshToken,
    isActive,
    normalizedCodingSessionId,
    normalizedSelectedCodingSessionProjectId,
    normalizedSelectedCodingSessionWorkspaceId,
    normalizedSelectedProjectId,
    normalizedSelectedProjectWorkspaceId,
    normalizedUserScope,
    selectedCodingSessionSynchronizationVersion,
    executionRefreshTick,
    workspaceId,
  ]);

  return isSelectedCodingSessionMessagesLoading;
}
