import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildAgentSessionProjectScopedKey,
  type BirdCoderProjectAgentSessionIndex,
} from '@sdkwork/birdcoder-pc-workbench/workbench/agentSessionSelection';
import type { BirdCoderProject } from '@sdkwork/birdcoder-pc-contracts-commons';
import { useCodeProjectSessionResolution } from './useCodeProjectSessionResolution';

interface UseCodePageSessionSelectionOptions {
  clearPendingNewAgentSessionRequest: () => void;
  hasFetchedProjects: boolean;
  initialAgentSessionId?: string;
  isVisible: boolean;
  onAgentSessionChange?: (agentSessionId: string, projectId?: string) => void;
  onProjectChange?: (projectId: string) => void;
  projectAgentSessionIndex: BirdCoderProjectAgentSessionIndex;
  projectId?: string;
}

export function useCodePageSessionSelection({
  clearPendingNewAgentSessionRequest,
  hasFetchedProjects,
  initialAgentSessionId,
  isVisible,
  onAgentSessionChange,
  onProjectChange,
  projectAgentSessionIndex,
  projectId,
}: UseCodePageSessionSelectionOptions) {
  const [sessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSessionProjectId, setSelectedSessionProjectId] = useState<string | null>(null);
  const [selectionRefreshToken, setSelectionRefreshToken] = useState(0);
  const pendingLocalAgentSessionSelectionKeyRef = useRef<string | null>(null);
  const lastNotifiedAgentSessionSelectionKeyRef = useRef<string | null>(null);
  const {
    latestAgentSessionIdByProjectId,
    resolveProjectById,
    resolveSession,
    resolveSessionInProject,
  } = useCodeProjectSessionResolution(projectAgentSessionIndex);

  const selectedAgentSessionLocation = resolveSessionInProject(
    sessionId,
    selectedSessionProjectId ?? projectId,
  );
  const sessionProjectId = selectedAgentSessionLocation?.project.id ?? '';
  const normalizedProjectId = projectId?.trim() ?? '';
  const normalizedSelectedSessionProjectId = selectedSessionProjectId?.trim() ?? '';
  const normalizedSessionProjectId = sessionProjectId?.trim() ?? '';
  const normalizedInitialAgentSessionId = initialAgentSessionId?.trim() || '';
  const currentProjectId =
    normalizedSessionProjectId || normalizedSelectedSessionProjectId || normalizedProjectId;
  const currentProject =
    selectedAgentSessionLocation?.project ??
    resolveProjectById(currentProjectId);

  const selectProjectWithoutAgentSession = useCallback((nextProjectId: string | null) => {
    const normalizedNextProjectId = nextProjectId?.trim() ?? '';
    setSelectedSessionId(null);
    setSelectedSessionProjectId(normalizedNextProjectId || null);
    if (normalizedNextProjectId) {
      pendingLocalAgentSessionSelectionKeyRef.current =
        buildAgentSessionProjectScopedKey(normalizedNextProjectId, '');
    }
  }, []);

  const selectSession = useCallback((
    nextAgentSessionId: string,
    options?: { projectId?: string },
  ) => {
    const normalizedAgentSessionId = nextAgentSessionId.trim();
    if (!normalizedAgentSessionId) {
      return;
    }

    clearPendingNewAgentSessionRequest();

    const resolvedScopedSession = resolveSessionInProject(
      normalizedAgentSessionId,
      options?.projectId,
    );
    const nextProjectId =
      options?.projectId?.trim() ||
      resolvedScopedSession?.project.id?.trim() ||
      '';

    if (
      normalizedAgentSessionId === (sessionId?.trim() || '') &&
      nextProjectId === currentProjectId
    ) {
      setSelectionRefreshToken((previousState) => previousState + 1);
      return;
    }

    pendingLocalAgentSessionSelectionKeyRef.current = nextProjectId
      ? buildAgentSessionProjectScopedKey(nextProjectId, normalizedAgentSessionId)
      : normalizedAgentSessionId;
    setSelectedSessionId(normalizedAgentSessionId);
    setSelectedSessionProjectId(nextProjectId || null);
  }, [
    clearPendingNewAgentSessionRequest,
    currentProjectId,
    resolveSessionInProject,
    sessionId,
  ]);

  const handleSidebarAgentSessionSelect = useCallback((
    nextAgentSessionId: string | null,
    nextProjectId?: string | null,
  ) => {
    clearPendingNewAgentSessionRequest();
    if (!nextAgentSessionId) {
      selectProjectWithoutAgentSession(null);
      return;
    }

    selectSession(nextAgentSessionId, {
      projectId: nextProjectId?.trim() || undefined,
    });
  }, [
    clearPendingNewAgentSessionRequest,
    selectProjectWithoutAgentSession,
    selectSession,
  ]);

  const restoreSelectionAfterRefresh = useCallback((
    targetProjectId: string,
    targetAgentSessionId: string | null,
  ) => {
    const normalizedTargetProjectId = targetProjectId.trim();
    const normalizedTargetAgentSessionId = targetAgentSessionId?.trim() ?? '';
    const normalizedSelectedAgentSessionId = sessionId?.trim() ?? '';

    if (
      normalizedTargetAgentSessionId &&
      normalizedTargetAgentSessionId === normalizedSelectedAgentSessionId &&
      normalizedTargetProjectId === currentProjectId
    ) {
      return;
    }

    if (targetAgentSessionId) {
      selectSession(targetAgentSessionId, {
        projectId: targetProjectId,
      });
      return;
    }
    if (targetProjectId) {
      selectProjectWithoutAgentSession(targetProjectId);
    }
  }, [
    currentProjectId,
    selectProjectWithoutAgentSession,
    selectSession,
    sessionId,
  ]);

  useEffect(() => {
    if (
      !normalizedSessionProjectId ||
      !onProjectChange ||
      onAgentSessionChange ||
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
    onAgentSessionChange,
    onProjectChange,
  ]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const currentLocalAgentSessionId = sessionId?.trim() || '';
    const currentLocalProjectId =
      normalizedSessionProjectId || normalizedSelectedSessionProjectId || '';
    const currentLocalSelectionKey = currentLocalProjectId
      ? buildAgentSessionProjectScopedKey(currentLocalProjectId, currentLocalAgentSessionId)
      : currentLocalAgentSessionId;
    if (
      pendingLocalAgentSessionSelectionKeyRef.current &&
      pendingLocalAgentSessionSelectionKeyRef.current === currentLocalSelectionKey
    ) {
      return;
    }

    if (!normalizedInitialAgentSessionId) {
      if (
        currentLocalAgentSessionId ||
        (
          normalizedProjectId &&
          normalizedSelectedSessionProjectId !== normalizedProjectId
        )
      ) {
        selectProjectWithoutAgentSession(normalizedProjectId || null);
      }
      return;
    }

    const resolvedInitialLocation = resolveSessionInProject(
      normalizedInitialAgentSessionId,
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

    const nextSelectionKey = buildAgentSessionProjectScopedKey(
      nextProjectId,
      normalizedInitialAgentSessionId,
    );
    if (currentLocalSelectionKey === nextSelectionKey) {
      return;
    }

    setSelectedSessionId(normalizedInitialAgentSessionId);
    setSelectedSessionProjectId(nextProjectId);
    lastNotifiedAgentSessionSelectionKeyRef.current = nextSelectionKey;
  }, [
    isVisible,
    normalizedInitialAgentSessionId,
    normalizedProjectId,
    normalizedSelectedSessionProjectId,
    normalizedSessionProjectId,
    resolveProjectById,
    resolveSessionInProject,
    selectProjectWithoutAgentSession,
    sessionId,
  ]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const nextAgentSessionId = sessionId?.trim() ?? '';
    const nextSelectionKey = currentProjectId
      ? buildAgentSessionProjectScopedKey(currentProjectId, nextAgentSessionId)
      : nextAgentSessionId;
    const initialSelectionKey =
      normalizedProjectId && normalizedInitialAgentSessionId
        ? buildAgentSessionProjectScopedKey(
            normalizedProjectId,
            normalizedInitialAgentSessionId,
          )
        : normalizedInitialAgentSessionId;
    if (nextSelectionKey === initialSelectionKey) {
      lastNotifiedAgentSessionSelectionKeyRef.current = nextSelectionKey;
      if (pendingLocalAgentSessionSelectionKeyRef.current === nextSelectionKey) {
        pendingLocalAgentSessionSelectionKeyRef.current = null;
      }
      return;
    }

    if (lastNotifiedAgentSessionSelectionKeyRef.current === nextSelectionKey) {
      return;
    }

    lastNotifiedAgentSessionSelectionKeyRef.current = nextSelectionKey;
    onAgentSessionChange?.(nextAgentSessionId, currentProjectId);
    if (pendingLocalAgentSessionSelectionKeyRef.current === nextSelectionKey) {
      pendingLocalAgentSessionSelectionKeyRef.current = null;
    }
  }, [
    currentProjectId,
    isVisible,
    normalizedInitialAgentSessionId,
    normalizedProjectId,
    onAgentSessionChange,
    sessionId,
  ]);

  useEffect(() => {
    if (!isVisible || !hasFetchedProjects) {
      return;
    }

    const normalizedSelectedAgentSessionId = sessionId?.trim() ?? '';
    if (!normalizedSelectedAgentSessionId) {
      return;
    }

    const retainedProjectId =
      selectedSessionProjectId?.trim() ||
      projectId?.trim() ||
      currentProjectId;
    if (resolveSessionInProject(normalizedSelectedAgentSessionId, retainedProjectId)) {
      return;
    }

    if (retainedProjectId && resolveProjectById(retainedProjectId)) {
      return;
    }

    selectProjectWithoutAgentSession(retainedProjectId || null);
  }, [
    currentProjectId,
    hasFetchedProjects,
    isVisible,
    projectId,
    resolveProjectById,
    resolveSessionInProject,
    selectProjectWithoutAgentSession,
    sessionId,
    selectedSessionProjectId,
  ]);

  const handleProjectSelect = useCallback((id: string | null) => {
    clearPendingNewAgentSessionRequest();
    if (id) {
      const targetProject = resolveProjectById(id);
      const targetLatestAgentSessionId = latestAgentSessionIdByProjectId.get(id) ?? null;
      const sessionBelongsToProject =
        !!sessionId &&
        selectedAgentSessionLocation?.project.id === id &&
        !!targetProject?.agentSessions.some(
          (agentSession) => agentSession.id === sessionId,
        );

      if (sessionBelongsToProject) {
        return;
      }

      if (targetLatestAgentSessionId) {
        selectSession(targetLatestAgentSessionId, { projectId: id });
        return;
      }

      selectProjectWithoutAgentSession(id);
    }
  }, [
    clearPendingNewAgentSessionRequest,
    latestAgentSessionIdByProjectId,
    resolveProjectById,
    selectProjectWithoutAgentSession,
    selectSession,
    selectedAgentSessionLocation?.project.id,
    sessionId,
  ]);

  return {
    currentProject: currentProject as BirdCoderProject | null,
    currentProjectId,
    handleProjectSelect,
    handleSidebarAgentSessionSelect,
    latestAgentSessionIdByProjectId,
    resolveProjectById,
    resolveSession,
    resolveSessionInProject,
    restoreSelectionAfterRefresh,
    selectedAgentSessionLocation,
    selectProjectWithoutAgentSession,
    selectSession,
    selectionRefreshToken,
    sessionId,
    setSelectedSessionId,
    setSelectedSessionProjectId,
    setSelectionRefreshToken,
  };
}
