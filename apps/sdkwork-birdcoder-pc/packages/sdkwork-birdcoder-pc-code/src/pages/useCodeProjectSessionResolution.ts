import { useCallback } from 'react';
import {
  buildAgentSessionProjectScopedKey,
  type BirdCoderProjectAgentSessionIndex,
} from '@sdkwork/birdcoder-pc-workbench/workbench/agentSessionSelection';

export function useCodeProjectSessionResolution(
  sessionIndex: BirdCoderProjectAgentSessionIndex,
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
      const normalizedAgentSessionId = id?.trim() ?? '';
      return normalizedAgentSessionId
        ? sessionIndex.agentSessionLocationsById.get(normalizedAgentSessionId) ?? null
        : null;
    },
    [sessionIndex],
  );
  const resolveSessionInProject = useCallback(
    (id: string | null | undefined, scopedProjectId?: string | null) => {
      const normalizedAgentSessionId = id?.trim() ?? '';
      if (!normalizedAgentSessionId) {
        return null;
      }

      const normalizedScopedProjectId = scopedProjectId?.trim() ?? '';
      if (normalizedScopedProjectId) {
        return sessionIndex.agentSessionLocationsByProjectIdAndId.get(
          buildAgentSessionProjectScopedKey(
            normalizedScopedProjectId,
            normalizedAgentSessionId,
          ),
        ) ?? null;
      }

      return resolveSession(normalizedAgentSessionId);
    },
    [resolveSession, sessionIndex],
  );

  return {
    latestAgentSessionIdByProjectId: sessionIndex.latestAgentSessionIdByProjectId,
    resolveProjectById,
    resolveSession,
    resolveSessionInProject,
  };
}
