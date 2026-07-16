import { useCallback } from 'react';
import { useProjectRuntimeLocation } from './useProjectRuntimeLocation.ts';

/**
 * Reads an existing local working directory without prompting. User actions
 * that may bind a folder use useProjectRuntimeLocation directly so cancellation
 * remains a non-error state instead of a missing-path error.
 */
export function useProjectLocalWorkingDirectory(): (projectId: string) => Promise<string | null> {
  const resolveProjectRuntimeLocation = useProjectRuntimeLocation();

  return useCallback(async (projectId: string): Promise<string | null> => {
    const resolution = await resolveProjectRuntimeLocation(projectId, {
      allowFolderSelection: false,
      capability: 'terminal',
    });
    return resolution.status === 'resolved'
      ? resolution.location.localWorkingDirectory
      : null;
  }, [resolveProjectRuntimeLocation]);
}
