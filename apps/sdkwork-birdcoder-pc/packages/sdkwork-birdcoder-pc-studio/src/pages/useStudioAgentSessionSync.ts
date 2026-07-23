import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import { buildAgentSessionProjectScopedKey } from '@sdkwork/birdcoder-pc-workbench';

interface UseStudioAgentSessionSyncOptions {
  isActive?: boolean;
  projects: AgentProjectView[];
  initialAgentSessionId?: string;
  initialProjectId?: string;
  onAgentSessionChange?: (agentSessionId: string, projectId?: string) => void;
  pendingLocalAgentSessionSelectionKeyRef: MutableRefObject<string | null>;
  selectedProjectId: string;
  selectedAgentSessionId: string;
  setSelectedAgentSessionId: Dispatch<SetStateAction<string>>;
  setSelectedAgentSessionProjectId: Dispatch<SetStateAction<string | null>>;
}

export function useStudioAgentSessionSync({
  isActive = true,
  projects,
  initialAgentSessionId,
  initialProjectId,
  onAgentSessionChange,
  pendingLocalAgentSessionSelectionKeyRef,
  selectedProjectId,
  selectedAgentSessionId,
  setSelectedAgentSessionId,
  setSelectedAgentSessionProjectId,
}: UseStudioAgentSessionSyncOptions) {
  const lastNotifiedAgentSessionIdRef = useRef<string>('');

  const buildSelectionKey = (projectId: string, agentSessionId: string) =>
    projectId
      ? buildAgentSessionProjectScopedKey(projectId, agentSessionId)
      : agentSessionId;

  const resolveScopedProjectId = (
    agentSessionId: string,
    projectId?: string,
  ): string => {
    const normalizedAgentSessionId = agentSessionId.trim();
    const normalizedProjectId = projectId?.trim() ?? '';
    if (!normalizedAgentSessionId) {
      return '';
    }

    if (
      normalizedProjectId &&
      projects.some((project) => project.projectId === normalizedProjectId)
    ) {
      return normalizedProjectId;
    }

    let matchedProjectId = '';
    for (const project of projects) {
      if (
        !project.agentSessions.some(
          (agentSession) => agentSession.id === normalizedAgentSessionId,
        )
      ) {
        continue;
      }

      if (matchedProjectId) {
        return '';
      }
      matchedProjectId = project.projectId;
    }

    return matchedProjectId;
  };

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const normalizedInitialAgentSessionId = initialAgentSessionId?.trim() || '';
    const normalizedInitialProjectId = initialProjectId?.trim() || '';
    const normalizedSelectedAgentSessionId = selectedAgentSessionId.trim();
    const normalizedSelectedProjectId = selectedProjectId.trim();
    const selectedSelectionKey = buildSelectionKey(
      normalizedSelectedProjectId,
      normalizedSelectedAgentSessionId,
    );
    if (
      pendingLocalAgentSessionSelectionKeyRef.current &&
      pendingLocalAgentSessionSelectionKeyRef.current === selectedSelectionKey
    ) {
      return;
    }

    if (!normalizedInitialAgentSessionId) {
      if (
        normalizedSelectedAgentSessionId ||
        (
          normalizedInitialProjectId &&
          normalizedSelectedProjectId !== normalizedInitialProjectId
        )
      ) {
        setSelectedAgentSessionId('');
        setSelectedAgentSessionProjectId(normalizedInitialProjectId || null);
      }
      return;
    }

    const resolvedInitialProjectId = resolveScopedProjectId(
      normalizedInitialAgentSessionId,
      normalizedInitialProjectId,
    );
    if (!resolvedInitialProjectId) {
      return;
    }

    const initialSelectionKey = buildSelectionKey(
      resolvedInitialProjectId,
      normalizedInitialAgentSessionId,
    );
    if (selectedSelectionKey === initialSelectionKey) {
      return;
    }

    setSelectedAgentSessionId(normalizedInitialAgentSessionId);
    setSelectedAgentSessionProjectId(resolvedInitialProjectId);
    lastNotifiedAgentSessionIdRef.current = initialSelectionKey;
  }, [
    initialAgentSessionId,
    initialProjectId,
    isActive,
    pendingLocalAgentSessionSelectionKeyRef,
    projects,
    selectedAgentSessionId,
    selectedProjectId,
    setSelectedAgentSessionId,
    setSelectedAgentSessionProjectId,
  ]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const normalizedInitialAgentSessionId = initialAgentSessionId?.trim() || '';
    const normalizedInitialProjectId = initialProjectId?.trim() || '';
    const normalizedSelectedAgentSessionId = selectedAgentSessionId.trim();
    const normalizedSelectedProjectId = selectedProjectId.trim();
    const selectedSelectionKey = buildSelectionKey(
      normalizedSelectedProjectId,
      normalizedSelectedAgentSessionId,
    );
    const initialSelectionKey =
      normalizedInitialProjectId && normalizedInitialAgentSessionId
        ? buildSelectionKey(normalizedInitialProjectId, normalizedInitialAgentSessionId)
        : normalizedInitialAgentSessionId;

    if (selectedSelectionKey === initialSelectionKey) {
      lastNotifiedAgentSessionIdRef.current = selectedSelectionKey;
      if (pendingLocalAgentSessionSelectionKeyRef.current === selectedSelectionKey) {
        pendingLocalAgentSessionSelectionKeyRef.current = null;
      }
      return;
    }

    if (lastNotifiedAgentSessionIdRef.current === selectedSelectionKey) {
      return;
    }

    lastNotifiedAgentSessionIdRef.current = selectedSelectionKey;
    onAgentSessionChange?.(normalizedSelectedAgentSessionId, normalizedSelectedProjectId);
    if (pendingLocalAgentSessionSelectionKeyRef.current === selectedSelectionKey) {
      pendingLocalAgentSessionSelectionKeyRef.current = null;
    }
  }, [
    initialAgentSessionId,
    initialProjectId,
    isActive,
    onAgentSessionChange,
    pendingLocalAgentSessionSelectionKeyRef,
    selectedAgentSessionId,
    selectedProjectId,
  ]);
}
