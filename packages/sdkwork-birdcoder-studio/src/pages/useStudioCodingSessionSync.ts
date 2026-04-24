import { useEffect, useRef } from 'react';

import type { BirdCoderProject } from '@sdkwork/birdcoder-types';

interface UseStudioCodingSessionSyncOptions {
  projects: BirdCoderProject[];
  initialCodingSessionId?: string;
  onCodingSessionChange?: (codingSessionId: string) => void;
  selectedCodingSessionId: string;
  selectCodingSession: (codingSessionId: string) => void;
}

export function useStudioCodingSessionSync({
  projects,
  initialCodingSessionId,
  onCodingSessionChange,
  selectedCodingSessionId,
  selectCodingSession,
}: UseStudioCodingSessionSyncOptions) {
  const lastNotifiedCodingSessionIdRef = useRef<string>('');

  useEffect(() => {
    const normalizedInitialCodingSessionId = initialCodingSessionId?.trim() || '';
    if (!normalizedInitialCodingSessionId) {
      return;
    }

    const hasSelectedCodingSession =
      !!selectedCodingSessionId &&
      projects.some((project) =>
        project.codingSessions.some((codingSession) => codingSession.id === selectedCodingSessionId),
      );
    if (hasSelectedCodingSession) {
      return;
    }

    if (
      normalizedInitialCodingSessionId !== selectedCodingSessionId &&
      projects.some((project) =>
        project.codingSessions.some(
          (codingSession) => codingSession.id === normalizedInitialCodingSessionId,
        ),
      )
    ) {
      selectCodingSession(normalizedInitialCodingSessionId);
    }
  }, [projects, initialCodingSessionId, selectedCodingSessionId, selectCodingSession]);

  useEffect(() => {
    const normalizedInitialCodingSessionId = initialCodingSessionId?.trim() || '';
    if (selectedCodingSessionId === normalizedInitialCodingSessionId) {
      lastNotifiedCodingSessionIdRef.current = selectedCodingSessionId;
      return;
    }

    if (lastNotifiedCodingSessionIdRef.current === selectedCodingSessionId) {
      return;
    }

    lastNotifiedCodingSessionIdRef.current = selectedCodingSessionId;
    onCodingSessionChange?.(selectedCodingSessionId);
  }, [initialCodingSessionId, onCodingSessionChange, selectedCodingSessionId]);
}
