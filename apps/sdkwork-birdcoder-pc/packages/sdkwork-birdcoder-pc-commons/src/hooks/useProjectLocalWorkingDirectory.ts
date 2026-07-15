import { useCallback } from 'react';
import { useIDEServices } from '../context/IDEContext.ts';

/**
 * Resolves a device-private working directory for local host actions.
 * Remote project metadata never participates in this lookup.
 */
export function useProjectLocalWorkingDirectory(): (projectId: string) => Promise<string | null> {
  const { fileSystemService } = useIDEServices();

  return useCallback(async (projectId: string): Promise<string | null> => {
    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
      return null;
    }

    return await fileSystemService.resolveLocalWorkingDirectory(normalizedProjectId);
  }, [fileSystemService]);
}
