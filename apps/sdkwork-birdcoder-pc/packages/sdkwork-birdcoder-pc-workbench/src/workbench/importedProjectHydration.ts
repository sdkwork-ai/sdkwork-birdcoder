import type {
  AgentProjectView,
  AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import { resolveLatestAgentSessionIdForProject } from './agentSessionSelection.ts';
import { refreshProjectSessions } from './sessionRefresh.ts';

export interface RefreshImportedProjectFromAuthorityOptions {
  agentSessionService: IAgentSessionService;
  knownProjects?: readonly AgentProjectView[];
  projectId: string;
  projectService: IProjectService;
  signal?: AbortSignal;
  /**
   * How the provider inventory import is treated: 'best-effort' for plain
   * refreshes (a slow provider store scan must never fail the refresh, which
   * continues with the persisted inventory), 'required' for explicit
   * provider Session imports that must surface import failures.
   */
  synchronizeMode?: 'best-effort' | 'required';
  syncTimeoutMs?: number;
  userScope?: string;
  workspaceId: string;
}

export interface ImportedProjectSessionInventoryResult {
  deletedSessionIds: string[];
  deletedSessionTombstones: AgentSessionView[];
  latestAgentSessionId: string | null;
  project: AgentProjectView;
  providerImport?: Awaited<ReturnType<IAgentSessionService['synchronizeProjectSessions']>>;
}

export async function refreshImportedProjectFromAuthority(
  options: RefreshImportedProjectFromAuthorityOptions,
): Promise<ImportedProjectSessionInventoryResult | null> {
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
    synchronizeMode: options.synchronizeMode ?? 'best-effort',
    syncTimeoutMs: options.syncTimeoutMs,
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
    providerImport: refreshed.providerSynchronization,
  };
}

export async function importProjectProviderSessions(
  options: RefreshImportedProjectFromAuthorityOptions,
): Promise<ImportedProjectSessionInventoryResult | null> {
  const projectId = options.projectId.trim();
  if (!projectId) {
    return null;
  }
  return refreshImportedProjectFromAuthority(options);
}

export function getProviderSessionImportFailureCount(
  result: ImportedProjectSessionInventoryResult | null,
): string | null {
  const count = result?.providerImport?.failedSessionCount;
  return count && count !== '0' ? count : null;
}
