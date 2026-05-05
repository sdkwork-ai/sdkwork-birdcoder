import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import type { BirdCoderProject } from '@sdkwork/birdcoder-types';
import { buildCodingSessionProjectScopedKey } from '@sdkwork/birdcoder-commons';

interface UseStudioCodingSessionSyncOptions {
  isActive?: boolean;
  projects: BirdCoderProject[];
  initialCodingSessionId?: string;
  initialProjectId?: string;
  onCodingSessionChange?: (codingSessionId: string, projectId?: string) => void;
  pendingLocalCodingSessionSelectionKeyRef: MutableRefObject<string | null>;
  selectedProjectId: string;
  selectedCodingSessionId: string;
  setSelectedCodingSessionId: Dispatch<SetStateAction<string>>;
  setSelectedCodingSessionProjectId: Dispatch<SetStateAction<string | null>>;
}

export function useStudioCodingSessionSync({
  isActive = true,
  projects,
  initialCodingSessionId,
  initialProjectId,
  onCodingSessionChange,
  pendingLocalCodingSessionSelectionKeyRef,
  selectedProjectId,
  selectedCodingSessionId,
  setSelectedCodingSessionId,
  setSelectedCodingSessionProjectId,
}: UseStudioCodingSessionSyncOptions) {
  const lastNotifiedCodingSessionIdRef = useRef<string>('');

  const buildSelectionKey = (projectId: string, codingSessionId: string) =>
    projectId
      ? buildCodingSessionProjectScopedKey(projectId, codingSessionId)
      : codingSessionId;

  const resolveScopedProjectId = (
    codingSessionId: string,
    projectId?: string,
  ): string => {
    const normalizedCodingSessionId = codingSessionId.trim();
    const normalizedProjectId = projectId?.trim() ?? '';
    if (!normalizedCodingSessionId) {
      return '';
    }

    if (
      normalizedProjectId &&
      projects.some((project) => project.id === normalizedProjectId)
    ) {
      return normalizedProjectId;
    }

    let matchedProjectId = '';
    for (const project of projects) {
      if (
        !project.codingSessions.some(
          (codingSession) => codingSession.id === normalizedCodingSessionId,
        )
      ) {
        continue;
      }

      if (matchedProjectId) {
        return '';
      }
      matchedProjectId = project.id;
    }

    return matchedProjectId;
  };

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const normalizedInitialCodingSessionId = initialCodingSessionId?.trim() || '';
    const normalizedInitialProjectId = initialProjectId?.trim() || '';
    const normalizedSelectedCodingSessionId = selectedCodingSessionId.trim();
    const normalizedSelectedProjectId = selectedProjectId.trim();
    const selectedSelectionKey = buildSelectionKey(
      normalizedSelectedProjectId,
      normalizedSelectedCodingSessionId,
    );
    if (
      pendingLocalCodingSessionSelectionKeyRef.current &&
      pendingLocalCodingSessionSelectionKeyRef.current === selectedSelectionKey
    ) {
      return;
    }

    if (!normalizedInitialCodingSessionId) {
      if (
        normalizedSelectedCodingSessionId ||
        (
          normalizedInitialProjectId &&
          normalizedSelectedProjectId !== normalizedInitialProjectId
        )
      ) {
        setSelectedCodingSessionId('');
        setSelectedCodingSessionProjectId(normalizedInitialProjectId || null);
      }
      return;
    }

    const resolvedInitialProjectId = resolveScopedProjectId(
      normalizedInitialCodingSessionId,
      normalizedInitialProjectId,
    );
    if (!resolvedInitialProjectId) {
      return;
    }

    const initialSelectionKey = buildSelectionKey(
      resolvedInitialProjectId,
      normalizedInitialCodingSessionId,
    );
    if (selectedSelectionKey === initialSelectionKey) {
      return;
    }

    setSelectedCodingSessionId(normalizedInitialCodingSessionId);
    setSelectedCodingSessionProjectId(resolvedInitialProjectId);
    lastNotifiedCodingSessionIdRef.current = initialSelectionKey;
  }, [
    initialCodingSessionId,
    initialProjectId,
    isActive,
    pendingLocalCodingSessionSelectionKeyRef,
    projects,
    selectedCodingSessionId,
    selectedProjectId,
    setSelectedCodingSessionId,
    setSelectedCodingSessionProjectId,
  ]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const normalizedInitialCodingSessionId = initialCodingSessionId?.trim() || '';
    const normalizedInitialProjectId = initialProjectId?.trim() || '';
    const normalizedSelectedCodingSessionId = selectedCodingSessionId.trim();
    const normalizedSelectedProjectId = selectedProjectId.trim();
    const selectedSelectionKey = buildSelectionKey(
      normalizedSelectedProjectId,
      normalizedSelectedCodingSessionId,
    );
    const initialSelectionKey =
      normalizedInitialProjectId && normalizedInitialCodingSessionId
        ? buildSelectionKey(normalizedInitialProjectId, normalizedInitialCodingSessionId)
        : normalizedInitialCodingSessionId;

    if (selectedSelectionKey === initialSelectionKey) {
      lastNotifiedCodingSessionIdRef.current = selectedSelectionKey;
      if (pendingLocalCodingSessionSelectionKeyRef.current === selectedSelectionKey) {
        pendingLocalCodingSessionSelectionKeyRef.current = null;
      }
      return;
    }

    if (lastNotifiedCodingSessionIdRef.current === selectedSelectionKey) {
      return;
    }

    lastNotifiedCodingSessionIdRef.current = selectedSelectionKey;
    onCodingSessionChange?.(normalizedSelectedCodingSessionId, normalizedSelectedProjectId);
    if (pendingLocalCodingSessionSelectionKeyRef.current === selectedSelectionKey) {
      pendingLocalCodingSessionSelectionKeyRef.current = null;
    }
  }, [
    initialCodingSessionId,
    initialProjectId,
    isActive,
    onCodingSessionChange,
    pendingLocalCodingSessionSelectionKeyRef,
    selectedCodingSessionId,
    selectedProjectId,
  ]);
}
