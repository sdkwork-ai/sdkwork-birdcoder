import assert from 'node:assert/strict';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderProject,
  BirdCoderProjectSummary,
} from '@sdkwork/birdcoder-types';
import { ApiBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type { IProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IProjectService.ts';

function createLocalProject(
  id: string,
  workspaceId: string,
  path: string,
): BirdCoderProject {
  return {
    id,
    workspaceId,
    name: `${id} local mirror`,
    description: `${id} has been imported into this IDE.`,
    path,
    createdAt: '2026-04-27T10:00:00.000Z',
    updatedAt: '2026-04-27T10:00:00.000Z',
    codingSessions: [],
  };
}

function createRemoteSummary(
  id: string,
  workspaceId: string,
  rootPath: string,
): BirdCoderProjectSummary {
  return {
    id,
    workspaceId,
    name: `${id} remote summary`,
    description: `${id} exists in the remote catalog.`,
    rootPath,
    status: 'active',
    createdAt: '2026-04-27T10:00:00.000Z',
    updatedAt: '2026-04-27T10:10:00.000Z',
  };
}

const importedSelectedProject = createLocalProject(
  'project-imported-selected',
  'workspace-selected',
  'D:\\repos\\imported-selected',
);
const importedOtherWorkspaceProject = createLocalProject(
  'project-imported-other-workspace',
  'workspace-other',
  'D:\\repos\\imported-other',
);
const remoteOnlySelectedProject = createRemoteSummary(
  'project-remote-only-selected',
  'workspace-selected',
  'D:\\repos\\remote-only-selected',
);
const remoteOnlyOtherWorkspaceProject = createRemoteSummary(
  'project-remote-only-other-workspace',
  'workspace-other',
  'D:\\repos\\remote-only-other',
);

const localProjects = [
  importedSelectedProject,
  importedOtherWorkspaceProject,
];
const remoteSummaries = [
  createRemoteSummary(
    importedSelectedProject.id,
    importedSelectedProject.workspaceId,
    importedSelectedProject.path!,
  ),
  createRemoteSummary(
    importedOtherWorkspaceProject.id,
    importedOtherWorkspaceProject.workspaceId,
    importedOtherWorkspaceProject.path!,
  ),
  remoteOnlySelectedProject,
  remoteOnlyOtherWorkspaceProject,
];

const listProjectRequests: Array<{ workspaceId?: string }> = [];
const mirroredProjectIds: string[] = [];

const client = {
  async listProjects(
    options?: Parameters<BirdCoderAppAdminApiClient['listProjects']>[0],
  ): Promise<Awaited<ReturnType<BirdCoderAppAdminApiClient['listProjects']>>> {
    listProjectRequests.push({ workspaceId: options?.workspaceId });
    return remoteSummaries.filter(
      (projectSummary) =>
        !options?.workspaceId || projectSummary.workspaceId === options.workspaceId,
    );
  },
} as unknown as BirdCoderAppAdminApiClient;

const writeService = {
  async getProjects(workspaceId?: string): Promise<BirdCoderProject[]> {
    return localProjects
      .filter((project) => !workspaceId || project.workspaceId === workspaceId)
      .map((project) => structuredClone(project));
  },
  async getProjectMirrorSnapshots(workspaceId?: string) {
    return localProjects
      .filter((project) => !workspaceId || project.workspaceId === workspaceId)
      .map((project) => ({
        ...structuredClone(project),
        codingSessions: [],
      }));
  },
  async syncProjectSummary(summary: BirdCoderProjectSummary): Promise<BirdCoderProject> {
    mirroredProjectIds.push(summary.id);
    return {
      id: summary.id,
      workspaceId: summary.workspaceId,
      name: summary.name,
      description: summary.description,
      path: summary.rootPath,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
      archived: summary.status === 'archived',
      codingSessions: [],
    };
  },
} as unknown as IProjectService & {
  syncProjectSummary(summary: BirdCoderProjectSummary): Promise<BirdCoderProject>;
};

const service = new ApiBackedProjectService({
  client,
  projectMirror: writeService,
  writeService,
});

const visibleProjects = await service.getProjects('workspace-selected');
const visibleSnapshots = await service.getProjectMirrorSnapshots('workspace-selected');

assert.deepEqual(
  visibleProjects.map((project) => project.id),
  ['project-imported-selected'],
  'project lists must only show projects imported into the selected workspace.',
);
assert.deepEqual(
  visibleSnapshots.map((project) => project.id),
  ['project-imported-selected'],
  'project mirror snapshot inventory must only show projects imported into the selected workspace.',
);
assert.equal(
  visibleProjects[0]?.workspaceId,
  'workspace-selected',
  'project lists must never leak projects from unselected workspaces.',
);
assert.equal(
  visibleSnapshots[0]?.workspaceId,
  'workspace-selected',
  'project snapshot lists must never leak projects from unselected workspaces.',
);
assert.deepEqual(
  mirroredProjectIds,
  ['project-imported-selected', 'project-imported-selected'],
  'project list reads must not auto-import remote catalog-only projects into the local mirror.',
);
assert.deepEqual(
  listProjectRequests,
  [
    { workspaceId: 'workspace-selected' },
    { workspaceId: 'workspace-selected' },
  ],
  'project list reads must always scope remote catalog requests to the selected workspace.',
);

console.log('api-backed project service imported list contract passed.');
