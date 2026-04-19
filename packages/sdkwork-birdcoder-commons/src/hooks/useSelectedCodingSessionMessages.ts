import { useEffect, useRef, useState } from 'react';
import {
  buildBirdCoderSessionSynchronizationVersion,
  type BirdCoderCodingSession,
  type BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import { useAuth } from '../context/AuthContext.ts';
import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import { upsertCodingSessionIntoProjectsStore } from './useProjects.ts';
import { refreshCodingSessionMessages } from '../workbench/sessionRefresh.ts';

type SelectedCodingSessionMessagesCoreReadService = NonNullable<
  Parameters<typeof refreshCodingSessionMessages>[0]['coreReadService']
>;

export interface UseSelectedCodingSessionMessagesOptions {
  coreReadService?: SelectedCodingSessionMessagesCoreReadService;
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
  codingSessionId: string,
  selectedCodingSession: BirdCoderCodingSession | null | undefined,
  selectedProject: BirdCoderProject | null | undefined,
  workspaceId: string | undefined,
): string {
  const normalizedCodingSessionId = normalizeSelectionScopePart(codingSessionId);
  const normalizedWorkspaceId =
    normalizeSelectionScopePart(selectedProject?.workspaceId) ||
    normalizeSelectionScopePart(selectedCodingSession?.workspaceId) ||
    normalizeSelectionScopePart(workspaceId);
  const normalizedProjectId =
    normalizeSelectionScopePart(selectedProject?.id) ||
    normalizeSelectionScopePart(selectedCodingSession?.projectId);

  return [
    normalizedWorkspaceId || 'workspace:unknown',
    normalizedProjectId || 'project:unknown',
    normalizedCodingSessionId,
  ].join('::');
}

const synchronizedSessionVersionsByScopeKey = new Map<string, string>();
const attemptedSessionVersionsByScopeKey = new Map<string, string>();
const inflightSynchronizationKeys = new Set<string>();
const processedSelectionRefreshKeyByScopeKey = new Map<string, string>();
const MAX_TRACKED_SYNCHRONIZATION_SCOPES = 512;

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
  projectService,
  selectionRefreshToken,
  selectedCodingSession,
  selectedCodingSessionId,
  selectedProject,
  workspaceId,
}: UseSelectedCodingSessionMessagesOptions): boolean {
  const { user } = useAuth();
  const activeSynchronizationCountRef = useRef(0);
  const [isSelectedCodingSessionMessagesLoading, setIsSelectedCodingSessionMessagesLoading] = useState(false);
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

  useEffect(() => {
    if (!normalizedCodingSessionId || !coreReadService) {
      activeSynchronizationCountRef.current = 0;
      setIsSelectedCodingSessionMessagesLoading((previousState) =>
        previousState ? false : previousState,
      );
      return;
    }

    const synchronizationScopeKey = buildSynchronizationScopeKey(
      normalizedCodingSessionId,
      selectedCodingSession,
      selectedProject,
      workspaceId,
    );
    const selectionRefreshKey = `${synchronizationScopeKey}:${selectionRefreshToken}`;
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

    const inflightSynchronizationKey = `${synchronizationScopeKey}:${synchronizationVersion}`;
    if (inflightSynchronizationKeys.has(inflightSynchronizationKey)) {
      return;
    }

    attemptedSessionVersionsByScopeKey.set(synchronizationScopeKey, synchronizationVersion);
    inflightSynchronizationKeys.add(inflightSynchronizationKey);
    activeSynchronizationCountRef.current += 1;
    setIsSelectedCodingSessionMessagesLoading((previousState) =>
      previousState ? previousState : true,
    );
    let isDisposed = false;

    const synchronizationTask = shouldBootstrapFromAuthority
      ? refreshCodingSessionMessages({
          codingSessionId: normalizedCodingSessionId,
          coreReadService,
          projectService,
          workspaceId,
        })
      : refreshCodingSessionMessages({
          codingSessionId: normalizedCodingSessionId,
          coreReadService,
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
          return;
        }

        if (!result || result.status !== 'refreshed' || !result.codingSession) {
          attemptedSessionVersionsByScopeKey.delete(synchronizationScopeKey);
          return;
        }

        upsertCodingSessionIntoProjectsStore(
          result.workspaceId ??
            resolvedProject?.workspaceId ??
            result.codingSession.workspaceId,
          result.projectId,
          result.codingSession,
          normalizedUserScope,
        );
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
        inflightSynchronizationKeys.delete(inflightSynchronizationKey);
        activeSynchronizationCountRef.current = Math.max(
          0,
          activeSynchronizationCountRef.current - 1,
        );
        if (!isDisposed && activeSynchronizationCountRef.current === 0) {
          setIsSelectedCodingSessionMessagesLoading((previousState) =>
            previousState ? false : previousState,
          );
        }
      });

    return () => {
      isDisposed = true;
    };
  }, [
    coreReadService,
    projectService,
    selectionRefreshToken,
    normalizedCodingSessionId,
    normalizedSelectedCodingSessionProjectId,
    normalizedSelectedCodingSessionWorkspaceId,
    normalizedSelectedProjectId,
    normalizedSelectedProjectWorkspaceId,
    normalizedUserScope,
    selectedCodingSessionSynchronizationVersion,
    workspaceId,
  ]);

  return isSelectedCodingSessionMessagesLoading;
}
