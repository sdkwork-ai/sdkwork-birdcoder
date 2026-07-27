import { useCallback } from 'react';
import type {
  ProjectRuntimeLocationCapability,
  ProjectRuntimeLocationInput,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import { useIDEServices } from '../context/IDEContext.ts';

export type ProjectLocalWorkingDirectoryResolver = (
  project: ProjectRuntimeLocationInput,
  capability?: ProjectRuntimeLocationCapability,
) => Promise<string | null>;

/**
 * Reads an existing local working directory without prompting. User actions
 * that may bind a folder use useProjectRuntimeLocation directly so cancellation
 * remains a non-error state instead of a missing-path error.
 */
export function useProjectLocalWorkingDirectory(): ProjectLocalWorkingDirectoryResolver {
  const { projectRuntimeLocationService } = useIDEServices();

  return useCallback((project, capability = 'file_system') =>
    projectRuntimeLocationService.resolveProjectLocalWorkingDirectory(project, {
      allowFolderSelection: false,
      capability,
    }), [projectRuntimeLocationService]);
}
