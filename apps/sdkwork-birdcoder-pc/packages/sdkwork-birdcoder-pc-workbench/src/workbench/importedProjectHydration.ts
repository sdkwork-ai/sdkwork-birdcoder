import type {
  AgentProjectView,
  AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import { resolveLatestAgentSessionIdForProject } from './agentSessionSelection.ts';
import { refreshProjectSessions } from './sessionRefresh.ts';

export interface HydrateImportedProjectFromAuthorityOptions {
  agentSessionService: IAgentSessionService;
  knownProjects?: readonly AgentProjectView[];
  projectId: string;
  projectService: IProjectService;
  signal?: AbortSignal;
  userScope?: string;
  workspaceId: string;
}

export interface HydrateImportedProjectFromAuthorityResult {
  deletedSessionIds: string[];
  deletedSessionTombstones: AgentSessionView[];
  latestAgentSessionId: string | null;
  project: AgentProjectView;
}

export async function hydrateImportedProjectFromAuthority(
  options: HydrateImportedProjectFromAuthorityOptions,
): Promise<HydrateImportedProjectFromAuthorityResult | null> {
  const projectId = options.projectId.trim();
  const workspaceId = options.workspaceId.trim();
  if (!projectId || !workspaceId) {
    return null;
  }
  options.signal?.throwIfAborted();
  const knownProject = options.knownProjects?.find(
    (project) => project.projectId === projectId,
  );
  const project = knownProject ?? await options.projectService.getProjectById(projectId);
  options.signal?.throwIfAborted();
  if (!project || project.workspaceId !== workspaceId) {
    return null;
  }
  const projectService = {
    getProjectById: async (requestedProjectId: string) =>
      requestedProjectId === projectId ? project : null,
  } as IProjectService;
  const refreshed = await refreshProjectSessions({
    agentSessionService: options.agentSessionService,
    projectId,
    projectService,
    signal: options.signal,
  });
  const refreshedProject = refreshed.projects?.[0];
  if (refreshed.status !== 'refreshed' || !refreshedProject) {
    return null;
  }
  return {
    deletedSessionIds: refreshed.deletedSessionIds,
    deletedSessionTombstones: refreshed.deletedSessionTombstones,
    latestAgentSessionId: resolveLatestAgentSessionIdForProject(
      [refreshedProject],
      projectId,
    ),
    project: refreshedProject,
  };
}
