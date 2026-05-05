import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildCodingSessionProjectScopedKey,
  type BirdCoderProjectCodingSessionIndex,
} from '@sdkwork/birdcoder-commons';
import type { BirdCoderProject } from '@sdkwork/birdcoder-types';
import { useCodeProjectSessionResolution } from './useCodeProjectSessionResolution';

interface UseCodePageSessionSelectionOptions {
  clearPendingNewCodingSessionRequest: () => void;
  hasFetchedProjects: boolean;
  initialCodingSessionId?: string;
  isVisible: boolean;
  onCodingSessionChange?: (codingSessionId: string, projectId?: string) => void;
  onProjectChange?: (projectId: string) => void;
  projectCodingSessionIndex: BirdCoderProjectCodingSessionIndex;
  projectId?: string;
}

export function useCodePageSessionSelection({
  clearPendingNewCodingSessionRequest,
  hasFetchedProjects,
  initialCodingSessionId,
  isVisible,
  onCodingSessionChange,
  onProjectChange,
  projectCodingSessionIndex,
  projectId,
}: UseCodePageSessionSelectionOptions) {
  const [sessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSessionProjectId, setSelectedSessionProjectId] = useState<string | null>(null);
  const [selectionRefreshToken, setSelectionRefreshToken] = useState(0);
  const pendingLocalCodingSessionSelectionKeyRef = useRef<string | null>(null);
  const lastNotifiedCodingSessionSelectionKeyRef = useRef<string | null>(null);
  const {
    latestCodingSessionIdByProjectId,
    resolveProjectById,
    resolveSession,
    resolveSessionInProject,
  } = useCodeProjectSessionResolution(projectCodingSessionIndex);

  const selectedCodingSessionLocation = resolveSessionInProject(
    sessionId,
    selectedSessionProjectId ?? projectId,
  );
  const sessionProjectId = selectedCodingSessionLocation?.project.id ?? '';
  const normalizedProjectId = projectId?.trim() ?? '';
  const normalizedSelectedSessionProjectId = selectedSessionProjectId?.trim() ?? '';
  const normalizedSessionProjectId = sessionProjectId?.trim() ?? '';
  const normalizedInitialCodingSessionId = initialCodingSessionId?.trim() || '';
  const currentProjectId =
    normalizedSessionProjectId || normalizedSelectedSessionProjectId || normalizedProjectId;
  const currentProject =
    selectedCodingSessionLocation?.project ??
    resolveProjectById(currentProjectId);

  const selectProjectWithoutCodingSession = useCallback((nextProjectId: string | null) => {
    const normalizedNextProjectId = nextProjectId?.trim() ?? '';
    setSelectedSessionId(null);
    setSelectedSessionProjectId(normalizedNextProjectId || null);
    if (normalizedNextProjectId) {
      pendingLocalCodingSessionSelectionKeyRef.current =
        buildCodingSessionProjectScopedKey(normalizedNextProjectId, '');
    }
  }, []);

  const selectSession = useCallback((
    nextCodingSessionId: string,
    options?: { projectId?: string },
  ) => {
    const normalizedCodingSessionId = nextCodingSessionId.trim();
    if (!normalizedCodingSessionId) {
      return;
    }

    clearPendingNewCodingSessionRequest();

    const resolvedScopedSession = resolveSessionInProject(
      normalizedCodingSessionId,
      options?.projectId,
    );
    const nextProjectId =
      options?.projectId?.trim() ||
      resolvedScopedSession?.project.id?.trim() ||
      '';

    if (
      normalizedCodingSessionId === (sessionId?.trim() || '') &&
      nextProjectId === currentProjectId
    ) {
      setSelectionRefreshToken((previousState) => previousState + 1);
      return;
    }

    pendingLocalCodingSessionSelectionKeyRef.current = nextProjectId
      ? buildCodingSessionProjectScopedKey(nextProjectId, normalizedCodingSessionId)
      : normalizedCodingSessionId;
    setSelectedSessionId(normalizedCodingSessionId);
    setSelectedSessionProjectId(nextProjectId || null);
  }, [
    clearPendingNewCodingSessionRequest,
    currentProjectId,
    resolveSessionInProject,
    sessionId,
  ]);

  const handleSidebarCodingSessionSelect = useCallback((
    nextCodingSessionId: string | null,
    nextProjectId?: string | null,
  ) => {
    clearPendingNewCodingSessionRequest();
    if (!nextCodingSessionId) {
      selectProjectWithoutCodingSession(null);
      return;
    }

    selectSession(nextCodingSessionId, {
      projectId: nextProjectId?.trim() || undefined,
    });
  }, [
    clearPendingNewCodingSessionRequest,
    selectProjectWithoutCodingSession,
    selectSession,
  ]);

  const restoreSelectionAfterRefresh = useCallback((
    targetProjectId: string,
    targetCodingSessionId: string | null,
  ) => {
    const normalizedTargetProjectId = targetProjectId.trim();
    const normalizedTargetCodingSessionId = targetCodingSessionId?.trim() ?? '';
    const normalizedSelectedCodingSessionId = sessionId?.trim() ?? '';

    if (
      normalizedTargetCodingSessionId &&
      normalizedTargetCodingSessionId === normalizedSelectedCodingSessionId &&
      normalizedTargetProjectId === currentProjectId
    ) {
      return;
    }

    if (targetCodingSessionId) {
      selectSession(targetCodingSessionId, {
        projectId: targetProjectId,
      });
      return;
    }
    if (targetProjectId) {
      selectProjectWithoutCodingSession(targetProjectId);
    }
  }, [
    currentProjectId,
    selectProjectWithoutCodingSession,
    selectSession,
    sessionId,
  ]);

  useEffect(() => {
    if (
      !normalizedSessionProjectId ||
      !onProjectChange ||
      onCodingSessionChange ||
      !isVisible ||
      normalizedSessionProjectId === normalizedProjectId
    ) {
      return;
    }

    onProjectChange(normalizedSessionProjectId);
  }, [
    isVisible,
    normalizedProjectId,
    normalizedSessionProjectId,
    onCodingSessionChange,
    onProjectChange,
  ]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const currentLocalCodingSessionId = sessionId?.trim() || '';
    const currentLocalProjectId =
      normalizedSessionProjectId || normalizedSelectedSessionProjectId || '';
    const currentLocalSelectionKey = currentLocalProjectId
      ? buildCodingSessionProjectScopedKey(currentLocalProjectId, currentLocalCodingSessionId)
      : currentLocalCodingSessionId;
    if (
      pendingLocalCodingSessionSelectionKeyRef.current &&
      pendingLocalCodingSessionSelectionKeyRef.current === currentLocalSelectionKey
    ) {
      return;
    }

    if (!normalizedInitialCodingSessionId) {
      if (
        currentLocalCodingSessionId ||
        (
          normalizedProjectId &&
          normalizedSelectedSessionProjectId !== normalizedProjectId
        )
      ) {
        selectProjectWithoutCodingSession(normalizedProjectId || null);
      }
      return;
    }

    const resolvedInitialLocation = resolveSessionInProject(
      normalizedInitialCodingSessionId,
      normalizedProjectId || undefined,
    );
    const scopedInitialProject = normalizedProjectId
      ? resolveProjectById(normalizedProjectId)
      : null;
    const nextProjectId =
      resolvedInitialLocation?.project.id ??
      scopedInitialProject?.id ??
      '';
    if (!nextProjectId) {
      return;
    }

    const nextSelectionKey = buildCodingSessionProjectScopedKey(
      nextProjectId,
      normalizedInitialCodingSessionId,
    );
    if (currentLocalSelectionKey === nextSelectionKey) {
      return;
    }

    setSelectedSessionId(normalizedInitialCodingSessionId);
    setSelectedSessionProjectId(nextProjectId);
    lastNotifiedCodingSessionSelectionKeyRef.current = nextSelectionKey;
  }, [
    isVisible,
    normalizedInitialCodingSessionId,
    normalizedProjectId,
    normalizedSelectedSessionProjectId,
    normalizedSessionProjectId,
    resolveProjectById,
    resolveSessionInProject,
    selectProjectWithoutCodingSession,
    sessionId,
  ]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const nextCodingSessionId = sessionId?.trim() ?? '';
    const nextSelectionKey = currentProjectId
      ? buildCodingSessionProjectScopedKey(currentProjectId, nextCodingSessionId)
      : nextCodingSessionId;
    const initialSelectionKey =
      normalizedProjectId && normalizedInitialCodingSessionId
        ? buildCodingSessionProjectScopedKey(
            normalizedProjectId,
            normalizedInitialCodingSessionId,
          )
        : normalizedInitialCodingSessionId;
    if (nextSelectionKey === initialSelectionKey) {
      lastNotifiedCodingSessionSelectionKeyRef.current = nextSelectionKey;
      if (pendingLocalCodingSessionSelectionKeyRef.current === nextSelectionKey) {
        pendingLocalCodingSessionSelectionKeyRef.current = null;
      }
      return;
    }

    if (lastNotifiedCodingSessionSelectionKeyRef.current === nextSelectionKey) {
      return;
    }

    lastNotifiedCodingSessionSelectionKeyRef.current = nextSelectionKey;
    onCodingSessionChange?.(nextCodingSessionId, currentProjectId);
    if (pendingLocalCodingSessionSelectionKeyRef.current === nextSelectionKey) {
      pendingLocalCodingSessionSelectionKeyRef.current = null;
    }
  }, [
    currentProjectId,
    isVisible,
    normalizedInitialCodingSessionId,
    normalizedProjectId,
    onCodingSessionChange,
    sessionId,
  ]);

  useEffect(() => {
    if (!isVisible || !hasFetchedProjects) {
      return;
    }

    const normalizedSelectedCodingSessionId = sessionId?.trim() ?? '';
    if (!normalizedSelectedCodingSessionId) {
      return;
    }

    const retainedProjectId =
      selectedSessionProjectId?.trim() ||
      projectId?.trim() ||
      currentProjectId;
    if (resolveSessionInProject(normalizedSelectedCodingSessionId, retainedProjectId)) {
      return;
    }

    if (retainedProjectId && resolveProjectById(retainedProjectId)) {
      return;
    }

    selectProjectWithoutCodingSession(retainedProjectId || null);
  }, [
    currentProjectId,
    hasFetchedProjects,
    isVisible,
    projectId,
    resolveProjectById,
    resolveSessionInProject,
    selectProjectWithoutCodingSession,
    sessionId,
    selectedSessionProjectId,
  ]);

  const handleProjectSelect = useCallback((id: string | null) => {
    clearPendingNewCodingSessionRequest();
    if (id) {
      const targetProject = resolveProjectById(id);
      const targetLatestCodingSessionId = latestCodingSessionIdByProjectId.get(id) ?? null;
      const sessionBelongsToProject =
        !!sessionId &&
        selectedCodingSessionLocation?.project.id === id &&
        !!targetProject?.codingSessions.some(
          (codingSession) => codingSession.id === sessionId,
        );

      if (sessionBelongsToProject) {
        return;
      }

      if (targetLatestCodingSessionId) {
        selectSession(targetLatestCodingSessionId, { projectId: id });
        return;
      }

      selectProjectWithoutCodingSession(id);
    }
  }, [
    clearPendingNewCodingSessionRequest,
    latestCodingSessionIdByProjectId,
    resolveProjectById,
    selectProjectWithoutCodingSession,
    selectSession,
    selectedCodingSessionLocation?.project.id,
    sessionId,
  ]);

  return {
    currentProject: currentProject as BirdCoderProject | null,
    currentProjectId,
    handleProjectSelect,
    handleSidebarCodingSessionSelect,
    latestCodingSessionIdByProjectId,
    resolveProjectById,
    resolveSession,
    resolveSessionInProject,
    restoreSelectionAfterRefresh,
    selectedCodingSessionLocation,
    selectProjectWithoutCodingSession,
    selectSession,
    selectionRefreshToken,
    sessionId,
    setSelectedSessionId,
    setSelectedSessionProjectId,
    setSelectionRefreshToken,
  };
}
