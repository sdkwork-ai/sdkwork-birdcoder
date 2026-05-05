import { useCallback } from 'react';
import {
  buildCodingSessionProjectScopedKey,
  type BirdCoderProjectCodingSessionIndex,
} from '@sdkwork/birdcoder-commons';

export function useCodeProjectSessionResolution(
  sessionIndex: BirdCoderProjectCodingSessionIndex,
) {
  const resolveProjectById = useCallback(
    (id: string | null | undefined) => {
      const normalizedProjectId = id?.trim() ?? '';
      return normalizedProjectId
        ? sessionIndex.projectsById.get(normalizedProjectId) ?? null
        : null;
    },
    [sessionIndex],
  );
  const resolveSession = useCallback(
    (id: string | null | undefined) => {
      const normalizedCodingSessionId = id?.trim() ?? '';
      return normalizedCodingSessionId
        ? sessionIndex.codingSessionLocationsById.get(normalizedCodingSessionId) ?? null
        : null;
    },
    [sessionIndex],
  );
  const resolveSessionInProject = useCallback(
    (id: string | null | undefined, scopedProjectId?: string | null) => {
      const normalizedCodingSessionId = id?.trim() ?? '';
      if (!normalizedCodingSessionId) {
        return null;
      }

      const normalizedScopedProjectId = scopedProjectId?.trim() ?? '';
      if (normalizedScopedProjectId) {
        return sessionIndex.codingSessionLocationsByProjectIdAndId.get(
          buildCodingSessionProjectScopedKey(
            normalizedScopedProjectId,
            normalizedCodingSessionId,
          ),
        ) ?? null;
      }

      return resolveSession(normalizedCodingSessionId);
    },
    [resolveSession, sessionIndex],
  );

  return {
    latestCodingSessionIdByProjectId: sessionIndex.latestCodingSessionIdByProjectId,
    resolveProjectById,
    resolveSession,
    resolveSessionInProject,
  };
}
