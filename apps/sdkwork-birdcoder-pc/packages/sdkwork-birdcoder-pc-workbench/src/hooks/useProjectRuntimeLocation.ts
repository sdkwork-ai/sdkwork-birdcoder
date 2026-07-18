import { useCallback } from 'react';
import type {
  ProjectRuntimeLocationResolution,
  ProjectRuntimeLocationResolutionRequest,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
export {
  ProjectRuntimeLocationExecutionUnavailableError,
  requireProjectRuntimeLocationExecutionId,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime/projectRuntimeLocation';
import { useIDEServices } from '../context/IDEContext.ts';

export type ProjectRuntimeLocationResolver = (
  projectId: string,
  request: ProjectRuntimeLocationResolutionRequest,
) => Promise<ProjectRuntimeLocationResolution>;

/**
 * Resolves a project execution location through the injected runtime service.
 * Pages choose whether a user action may open the native folder picker; the
 * service owns recovery, durable binding, and host capability checks.
 */
export function useProjectRuntimeLocation(): ProjectRuntimeLocationResolver {
  const { projectRuntimeLocationService } = useIDEServices();

  return useCallback(async (projectId, request) => {
    return await projectRuntimeLocationService.resolveProjectRuntimeLocation(projectId, request);
  }, [projectRuntimeLocationService]);
}

export type {
  ProjectRuntimeLocationResolution,
  ProjectRuntimeLocationResolutionRequest,
};
