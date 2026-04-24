import type { BirdCoderProject } from '@sdkwork/birdcoder-types';
import { upsertProjectIntoProjectsStore } from '../stores/projectsStore.ts';
import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import { resolveLatestCodingSessionIdForProject } from './codingSessionSelection.ts';

export interface HydrateImportedProjectFromAuthorityOptions {
  knownProjects?: readonly BirdCoderProject[];
  projectId: string;
  projectService: IProjectService;
  userScope?: string;
  workspaceId: string;
}

export interface HydrateImportedProjectFromAuthorityResult {
  latestCodingSessionId: string | null;
  project: BirdCoderProject;
}

const inflightImportedProjectHydrations = new Map<
  string,
  Promise<HydrateImportedProjectFromAuthorityResult | null>
>();

function buildImportedProjectHydrationKey(
  userScope: string | null | undefined,
  workspaceId: string,
  projectId: string,
): string {
  const normalizedUserScope =
    typeof userScope === 'string' && userScope.trim().length > 0
      ? userScope.trim()
      : 'anonymous';
  return `${normalizedUserScope}:${workspaceId.trim()}:${projectId.trim()}`;
}

function resolveKnownImportedProject(
  knownProjects: readonly BirdCoderProject[] | undefined,
  workspaceId: string,
  projectId: string,
): BirdCoderProject | null {
  const normalizedWorkspaceId = workspaceId.trim();
  const normalizedProjectId = projectId.trim();
  if (!normalizedWorkspaceId || !normalizedProjectId || !knownProjects) {
    return null;
  }

  return (
    knownProjects.find(
      (project) =>
        project.id === normalizedProjectId &&
        project.workspaceId.trim() === normalizedWorkspaceId,
    ) ?? null
  );
}

export async function hydrateImportedProjectFromAuthority(
  options: HydrateImportedProjectFromAuthorityOptions,
): Promise<HydrateImportedProjectFromAuthorityResult | null> {
  const normalizedWorkspaceId = options.workspaceId.trim();
  const normalizedProjectId = options.projectId.trim();
  if (!normalizedWorkspaceId || !normalizedProjectId) {
    return null;
  }

  const knownProject = resolveKnownImportedProject(
    options.knownProjects,
    normalizedWorkspaceId,
    normalizedProjectId,
  );
  if (knownProject && knownProject.codingSessions.length > 0) {
    upsertProjectIntoProjectsStore(
      normalizedWorkspaceId,
      knownProject,
      options.userScope,
    );
    return {
      latestCodingSessionId: resolveLatestCodingSessionIdForProject(
        [knownProject],
        normalizedProjectId,
      ),
      project: knownProject,
    };
  }

  const hydrationKey = buildImportedProjectHydrationKey(
    options.userScope,
    normalizedWorkspaceId,
    normalizedProjectId,
  );
  const inflightHydration = inflightImportedProjectHydrations.get(hydrationKey);
  if (inflightHydration) {
    return inflightHydration;
  }

  const hydrationTask = (async () => {
    await options.projectService.invalidateProjectReadCache?.({
      projectId: normalizedProjectId,
      workspaceId: normalizedWorkspaceId,
    });
    const authoritativeProject = await options.projectService.getProjectById(
      normalizedProjectId,
    );
    if (
      !authoritativeProject ||
      authoritativeProject.workspaceId.trim() !== normalizedWorkspaceId
    ) {
      return null;
    }

    upsertProjectIntoProjectsStore(
      normalizedWorkspaceId,
      authoritativeProject,
      options.userScope,
    );
    return {
      latestCodingSessionId: resolveLatestCodingSessionIdForProject(
        [authoritativeProject],
        normalizedProjectId,
      ),
      project: authoritativeProject,
    };
  })().finally(() => {
    if (inflightImportedProjectHydrations.get(hydrationKey) === hydrationTask) {
      inflightImportedProjectHydrations.delete(hydrationKey);
    }
  });

  inflightImportedProjectHydrations.set(hydrationKey, hydrationTask);
  return hydrationTask;
}
