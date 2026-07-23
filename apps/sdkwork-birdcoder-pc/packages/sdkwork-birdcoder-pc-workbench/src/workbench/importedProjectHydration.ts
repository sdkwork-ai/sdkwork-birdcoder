import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import { upsertProjectIntoProjectsStore } from '../stores/projectsStore.ts';
import { resolveLatestAgentSessionIdForProject } from './agentSessionSelection.ts';
import { refreshProjectSessions } from './sessionRefresh.ts';

export interface HydrateImportedProjectFromAuthorityOptions {
  agentSessionService: IAgentSessionService;
  knownProjects?: readonly AgentProjectView[];
  projectId: string;
  projectService: IProjectService;
  userScope?: string;
}

export interface HydrateImportedProjectFromAuthorityResult {
  latestAgentSessionId: string | null;
  project: AgentProjectView;
}

const inflightHydrations = new Map<
  string,
  Promise<HydrateImportedProjectFromAuthorityResult | null>
>();

export async function hydrateImportedProjectFromAuthority(
  options: HydrateImportedProjectFromAuthorityOptions,
): Promise<HydrateImportedProjectFromAuthorityResult | null> {
  const projectId = options.projectId.trim();
  if (!projectId) {
    return null;
  }
  const scopeKey = `${options.userScope?.trim() || 'anonymous'}:${projectId}`;
  const inflight = inflightHydrations.get(scopeKey);
  if (inflight) {
    return inflight;
  }

  const task = (async () => {
    const result = await refreshProjectSessions({
      agentSessionService: options.agentSessionService,
      projectId,
      projectService: options.projectService,
    });
    const project = result.projects?.[0] ?? null;
    if (!project) {
      return null;
    }
    upsertProjectIntoProjectsStore(project, options.userScope);
    return {
      latestAgentSessionId: resolveLatestAgentSessionIdForProject([project], projectId),
      project,
    };
  })().finally(() => {
    if (inflightHydrations.get(scopeKey) === task) {
      inflightHydrations.delete(scopeKey);
    }
  });
  inflightHydrations.set(scopeKey, task);
  return task;
}
