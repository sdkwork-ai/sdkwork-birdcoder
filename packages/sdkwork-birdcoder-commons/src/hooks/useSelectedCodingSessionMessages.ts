import { useEffect, useMemo, useRef, useState } from 'react';
import { canSubscribeBirdCoderWorkspaceRealtime } from '@sdkwork/birdcoder-infrastructure-runtime';
import {
  isBirdCoderCodingSessionExecuting,
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
const SELECTED_SESSION_REALTIME_FALLBACK_EXECUTING_REFRESH_INTERVAL_MS = 15000;
const SELECTED_SESSION_REALTIME_FALLBACK_IDLE_REFRESH_INTERVAL_MS = 60000;

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

  let hasReplyAfterLatestUserMessage = false;
  for (let index = codingSession.messages.length - 1; index >= 0; index -= 1) {
    const message = codingSession.messages[index];
    if (isReplyMessageRole(message.role)) {
      hasReplyAfterLatestUserMessage = true;
      continue;
    }

    if (message.role !== 'user') {
      continue;
    }

    return !hasReplyAfterLatestUserMessage;
  }

  return false;
}

function parseSelectedTranscriptTimestamp(value: string | null | undefined): number {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return Number.NaN;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NaN : timestamp;
}

function readSelectedCodingSessionLatestMessageTimestamp(
  codingSession: BirdCoderCodingSession,
): number {
  const latestMessage = codingSession.messages[codingSession.messages.length - 1];
  return parseSelectedTranscriptTimestamp(latestMessage?.createdAt);
}

function shouldHydrateSelectedCodingSessionTranscript(
  codingSession: BirdCoderCodingSession | null | undefined,
): boolean {
  if (!codingSession || codingSession.messages.length === 0) {
    return true;
  }

  const transcriptUpdatedAt = parseSelectedTranscriptTimestamp(
    codingSession.transcriptUpdatedAt,
  );
  if (Number.isNaN(transcriptUpdatedAt)) {
    return false;
  }

  const latestMessageTimestamp = readSelectedCodingSessionLatestMessageTimestamp(codingSession);
  return Number.isNaN(latestMessageTimestamp) || transcriptUpdatedAt > latestMessageTimestamp;
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
  const [isSelectedCodingSessionMessagesLoading, setIsSelectedCodingSessionMessagesLoading] = useState(false);
  const [authorityFallbackRefreshTick, setAuthorityFallbackRefreshTick] = useState(0);
  const normalizedUserScope = user?.id?.trim() ?? 'anonymous';
  const normalizedCodingSessionId = selectedCodingSessionId?.trim() ?? '';
  const normalizedSelectedProjectId = selectedProject?.id?.trim() ?? '';
  const normalizedSelectedProjectWorkspaceId = selectedProject?.workspaceId?.trim() ?? '';
  const normalizedSelectedCodingSessionProjectId = selectedCodingSession?.projectId?.trim() ?? '';
  const normalizedSelectedCodingSessionWorkspaceId =
    selectedCodingSession?.workspaceId?.trim() ?? '';
  const normalizedSelectedCodingSessionTranscriptUpdatedAt =
    selectedCodingSession?.transcriptUpdatedAt?.trim() ?? '';
  const selectedCodingSessionMessageCount = selectedCodingSession?.messages.length ?? 0;
  const selectedCodingSessionLastMessage =
    selectedCodingSessionMessageCount > 0
      ? selectedCodingSession?.messages[selectedCodingSessionMessageCount - 1]
      : undefined;
  const selectedCodingSessionLastMessageCreatedAt =
    selectedCodingSessionLastMessage?.createdAt?.trim() ?? '';
  const selectedSessionWorkspaceId =
    normalizedSelectedProjectWorkspaceId ||
    normalizedSelectedCodingSessionWorkspaceId ||
    workspaceId?.trim() ||
    '';
  const canUseWorkspaceRealtime = useMemo(
    () => Boolean(selectedSessionWorkspaceId) && canSubscribeBirdCoderWorkspaceRealtime(),
    [normalizedUserScope, selectedSessionWorkspaceId],
  );
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
    if (
      !isActive ||
      !coreReadService ||
      isSelectedCodingSessionMessagesLoading ||
      !normalizedCodingSessionId ||
      canUseWorkspaceRealtime
    ) {
      return;
    }

    const fallbackRefreshDelay =
      (isSelectedCodingSessionExecuting || hasSelectedCodingSessionPendingReply)
        ? SELECTED_SESSION_REALTIME_FALLBACK_EXECUTING_REFRESH_INTERVAL_MS
        : SELECTED_SESSION_REALTIME_FALLBACK_IDLE_REFRESH_INTERVAL_MS;
    const refreshTimer = window.setTimeout(() => {
      setAuthorityFallbackRefreshTick((previousState) => previousState + 1);
    }, fallbackRefreshDelay);

    return () => {
      window.clearTimeout(refreshTimer);
    };
  }, [
    coreReadService,
    canUseWorkspaceRealtime,
    hasSelectedCodingSessionPendingReply,
    isActive,
    isSelectedCodingSessionMessagesLoading,
    isSelectedCodingSessionExecuting,
    normalizedCodingSessionId,
  ]);

  useEffect(() => {
    const localTranscriptReader =
      projectService.getCodingSessionTranscript?.bind(projectService);
    if (
      !isActive ||
      !normalizedCodingSessionId ||
      (!coreReadService && !localTranscriptReader)
    ) {
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
    const synchronizationRequestKey =
      `${synchronizationScopeKey}:${selectionRefreshToken}:${authorityFallbackRefreshTick}`;
    const hadSynchronizedSessionVersion =
      synchronizedSessionVersionsByScopeKey.has(synchronizationScopeKey);
    if (
      processedSelectionRefreshKeyByScopeKey.get(synchronizationScopeKey) !==
      synchronizationRequestKey
    ) {
      synchronizedSessionVersionsByScopeKey.delete(synchronizationScopeKey);
      attemptedSessionVersionsByScopeKey.delete(synchronizationScopeKey);
      setTrackedScopeValue(
        processedSelectionRefreshKeyByScopeKey,
        synchronizationScopeKey,
        synchronizationRequestKey,
      );
    }

    const selectedProjectCodingSession =
      selectedProject?.codingSessions.find(
        (codingSession) => codingSession.id === normalizedCodingSessionId,
      ) ?? null;
    const resolvedCodingSession =
      selectedCodingSession?.id === normalizedCodingSessionId
        ? selectedCodingSession
        : selectedProjectCodingSession;
    const resolvedProject =
      selectedProject &&
      (
        !resolvedCodingSession ||
        selectedProject.id === resolvedCodingSession.projectId ||
        selectedProjectCodingSession === resolvedCodingSession
      )
        ? selectedProject
        : null;
    const shouldBootstrapFromAuthority = !resolvedProject || !resolvedCodingSession;
    const shouldHydrateLocalTranscript =
      Boolean(resolvedProject) &&
      Boolean(localTranscriptReader) &&
      shouldHydrateSelectedCodingSessionTranscript(resolvedCodingSession);
    const shouldSynchronizeAuthority =
      shouldBootstrapFromAuthority ||
      authorityFallbackRefreshTick > 0 ||
      (!canUseWorkspaceRealtime && !shouldHydrateLocalTranscript);
    const shouldShowForegroundLoading =
      !hadSynchronizedSessionVersion &&
      (
        shouldBootstrapFromAuthority ||
        (resolvedCodingSession !== null && resolvedCodingSession.messages.length === 0)
      );

    const synchronizationVersion =
      resolvedCodingSession && resolvedProject
        ? synchronizationRequestKey
        : `bootstrap:${synchronizationRequestKey}`;
    if (
      synchronizedSessionVersionsByScopeKey.get(synchronizationScopeKey) ===
      synchronizationVersion &&
      !shouldHydrateLocalTranscript
    ) {
      return;
    }
    if (
      attemptedSessionVersionsByScopeKey.get(synchronizationScopeKey) ===
      synchronizationVersion &&
      !shouldHydrateLocalTranscript
    ) {
      return;
    }

    setTrackedScopeValue(
      attemptedSessionVersionsByScopeKey,
      synchronizationScopeKey,
      synchronizationVersion,
    );
    activeSynchronizationCountRef.current += 1;
    if (shouldShowForegroundLoading) {
      setIsSelectedCodingSessionMessagesLoading((previousState) =>
        previousState ? previousState : true,
      );
    }
    let isDisposed = false;

    const synchronizationTask = (async () => {
      let localTranscriptCodingSession: BirdCoderCodingSession | null = null;
      let refreshResolvedLocation =
        resolvedProject && resolvedCodingSession
          ? {
              codingSession: resolvedCodingSession,
              project: resolvedProject,
            }
          : null;

      if (shouldHydrateLocalTranscript && localTranscriptReader && resolvedProject) {
        localTranscriptCodingSession = await localTranscriptReader(
          resolvedProject.id,
          normalizedCodingSessionId,
          {
            expectedTranscriptUpdatedAt: resolvedCodingSession?.transcriptUpdatedAt ?? null,
          },
        ).catch((error) => {
          console.error(
            `Failed to hydrate local transcript for selected coding session "${normalizedCodingSessionId}"`,
            error,
          );
          return null;
        });

        if (localTranscriptCodingSession && !isDisposed) {
          refreshResolvedLocation = {
            codingSession: localTranscriptCodingSession,
            project: resolvedProject,
          };
          if (localTranscriptCodingSession.messages.length > 0) {
            upsertCodingSessionIntoProjectsStore(
              resolvedProject.workspaceId?.trim() ||
                localTranscriptCodingSession.workspaceId,
              resolvedProject.id,
              localTranscriptCodingSession,
              normalizedUserScope,
            );
          }
        }
      }

      const shouldRunAuthorityRefresh =
        shouldSynchronizeAuthority ||
        (
          !canUseWorkspaceRealtime &&
          shouldHydrateLocalTranscript &&
          (localTranscriptCodingSession?.messages.length ?? 0) === 0
        );

      if (!shouldRunAuthorityRefresh && localTranscriptCodingSession) {
        return {
          codingSessionId: normalizedCodingSessionId,
          codingSession: localTranscriptCodingSession,
          messageCount: localTranscriptCodingSession.messages.length,
          projectId: resolvedProject?.id ?? localTranscriptCodingSession.projectId,
          source: 'engine' as const,
          status: 'refreshed' as const,
          workspaceId:
            resolvedProject?.workspaceId?.trim() ||
            localTranscriptCodingSession.workspaceId,
        };
      }

      if (!refreshResolvedLocation && resolvedProject) {
        return {
          codingSessionId: normalizedCodingSessionId,
          messageCount: 0,
          projectId: resolvedProject.id,
          source: 'engine' as const,
          status: 'not-found' as const,
          workspaceId: resolvedProject.workspaceId,
        };
      }

      if (!refreshResolvedLocation) {
        return refreshCodingSessionMessages({
          codingSessionId: normalizedCodingSessionId,
          coreReadService,
          identityScope: normalizedUserScope,
          projectService,
          workspaceId,
        });
      }

      return refreshCodingSessionMessages({
        codingSessionId: normalizedCodingSessionId,
        coreReadService,
        identityScope: normalizedUserScope,
        projectService,
        resolvedLocation: refreshResolvedLocation,
        workspaceId: refreshResolvedLocation.project.workspaceId?.trim() || workspaceId,
      });
    })();

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
          }
          upsertCodingSessionIntoProjectsStore(
            result.workspaceId?.trim() ||
              synchronizedProject?.workspaceId?.trim() ||
              resolvedProject?.workspaceId?.trim() ||
              result.codingSession.workspaceId,
            result.projectId,
            result.codingSession,
            normalizedUserScope,
          );
        }
        setTrackedScopeValue(
          synchronizedSessionVersionsByScopeKey,
          synchronizationScopeKey,
          synchronizationRequestKey,
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
    normalizedSelectedCodingSessionTranscriptUpdatedAt,
    normalizedSelectedCodingSessionWorkspaceId,
    selectedCodingSessionLastMessageCreatedAt,
    selectedCodingSessionMessageCount,
    normalizedSelectedProjectId,
    normalizedSelectedProjectWorkspaceId,
    normalizedUserScope,
    authorityFallbackRefreshTick,
    workspaceId,
  ]);

  return isSelectedCodingSessionMessagesLoading;
}
