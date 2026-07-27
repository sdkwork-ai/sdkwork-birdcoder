import { useCallback } from 'react';
import type {
  ProjectRuntimeLocationInput,
  ProjectRuntimeLocationResolution,
  ProjectRuntimeLocationResolutionRequest,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
export {
  ProjectRuntimeLocationExecutionUnavailableError,
  requireProjectRuntimeLocationExecutionId,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime/projectRuntimeLocation';
import { useIDEServices } from '../context/IDEContext.ts';

export type ProjectRuntimeLocationResolver = (
  project: ProjectRuntimeLocationInput,
  request: ProjectRuntimeLocationResolutionRequest,
) => Promise<ProjectRuntimeLocationResolution>;

/**
 * Resolves a project execution location through the injected runtime service.
 * Pages choose whether a user action may open the native folder picker; the
 * service owns recovery, durable binding, and host capability checks.
 */
export function useProjectRuntimeLocation(): ProjectRuntimeLocationResolver {
  const { projectRuntimeLocationService } = useIDEServices();

  return useCallback(async (project, request) => {
    return await projectRuntimeLocationService.resolveProjectRuntimeLocation(project, request);
  }, [projectRuntimeLocationService]);
}

export function useProjectRuntimeLocationId(): (
  project: ProjectRuntimeLocationInput,
  capability: ProjectRuntimeLocationResolutionRequest['capability'],
) => Promise<string | null> {
  const { projectRuntimeLocationService } = useIDEServices();

  return useCallback(async (project, capability) => {
    return await projectRuntimeLocationService.resolveProjectRuntimeLocationId(
      project,
      capability,
    );
  }, [projectRuntimeLocationService]);
}

export function useProjectRuntimeLocationExecutionId(): (
  project: ProjectRuntimeLocationInput,
  capability: ProjectRuntimeLocationResolutionRequest['capability'],
  options?: { allowFolderSelection?: boolean },
) => Promise<string> {
  const { projectRuntimeLocationService } = useIDEServices();
  return useCallback(async (project, capability, options) => {
    return await projectRuntimeLocationService.resolveProjectRuntimeLocationExecutionId(
      project,
      capability,
      options,
    );
  }, [projectRuntimeLocationService]);
}

export type {
  ProjectRuntimeLocationInput,
  ProjectRuntimeLocationResolution,
  ProjectRuntimeLocationResolutionRequest,
};
