import { useEffect } from 'react';

import type { BirdCoderProject } from '@sdkwork/birdcoder-types';

interface UseStudioCodingSessionSyncOptions {
  filteredProjects: BirdCoderProject[];
  initialCodingSessionId?: string;
  onCodingSessionChange?: (codingSessionId: string) => void;
  selectedCodingSessionId: string;
  setSelectedThreadId: (codingSessionId: string) => void;
}

export function useStudioCodingSessionSync({
  filteredProjects,
  initialCodingSessionId,
  onCodingSessionChange,
  selectedCodingSessionId,
  setSelectedThreadId,
}: UseStudioCodingSessionSyncOptions) {
  useEffect(() => {
    const normalizedInitialCodingSessionId = initialCodingSessionId?.trim() || '';
    if (!normalizedInitialCodingSessionId) {
      return;
    }

    const hasSelectedCodingSession =
      !!selectedCodingSessionId &&
      filteredProjects.some((project) =>
        project.codingSessions.some((codingSession) => codingSession.id === selectedCodingSessionId),
      );
    if (hasSelectedCodingSession) {
      return;
    }

    if (
      normalizedInitialCodingSessionId !== selectedCodingSessionId &&
      filteredProjects.some((project) =>
        project.codingSessions.some(
          (codingSession) => codingSession.id === normalizedInitialCodingSessionId,
        ),
      )
    ) {
      setSelectedThreadId(normalizedInitialCodingSessionId);
    }
  }, [filteredProjects, initialCodingSessionId, selectedCodingSessionId, setSelectedThreadId]);

  useEffect(() => {
    const normalizedInitialCodingSessionId = initialCodingSessionId?.trim() || '';
    if (selectedCodingSessionId === normalizedInitialCodingSessionId) {
      return;
    }

    onCodingSessionChange?.(selectedCodingSessionId);
  }, [initialCodingSessionId, onCodingSessionChange, selectedCodingSessionId]);
}
