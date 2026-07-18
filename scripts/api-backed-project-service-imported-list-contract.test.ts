import type {
  BirdCoderAppRuntimeReadSdkApiClient,
  BirdCoderAppSdkApiClient,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';
import type {
  BirdCoderProject,
  BirdCoderProjectSummary,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { ApiBackedProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type { IProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IProjectService.ts';

function createLocalProject(
  id: string,
  workspaceId: string,
): BirdCoderProject {
  return {
    id,
    workspaceId,
    name: `${id} local mirror`,
    description: `${id} has been imported into this IDE.`,
    createdAt: '2026-04-27T10:00:00.000Z',
    updatedAt: '2026-04-27T10:00:00.000Z',
    codingSessions: [],
  };
}

function createRemoteSummary(
  id: string,
  workspaceId: string,
): BirdCoderProjectSummary {
  return {
    id,
    workspaceId,
    name: `${id} remote summary`,
    description: `${id} exists in the remote catalog.`,
    status: 'active',
    createdAt: '2026-04-27T10:00:00.000Z',
    updatedAt: '2026-04-27T10:10:00.000Z',
  } as BirdCoderProjectSummary;
}

const importedSelectedProject = createLocalProject(
  'project-imported-selected',
  'workspace-selected',
);
const importedOtherWorkspaceProject = createLocalProject(
  'project-imported-other-workspace',
  'workspace-other',
);
const remoteOnlySelectedProject = createRemoteSummary(
  'project-remote-only-selected',
  'workspace-selected',
);
const remoteOnlyOtherWorkspaceProject = createRemoteSummary(
  'project-remote-only-other-workspace',
  'workspace-other',
);

const localProjects = [
  importedSelectedProject,
  importedOtherWorkspaceProject,
];
const remoteSummaries = [
  createRemoteSummary(importedSelectedProject.id, importedSelectedProject.workspaceId),
  createRemoteSummary(importedOtherWorkspaceProject.id, importedOtherWorkspaceProject.workspaceId),
  remoteOnlySelectedProject,
  remoteOnlyOtherWorkspaceProject,
];

const listProjectRequests: Array<{ workspaceId?: string }> = [];
const mirroredProjectIds: string[] = [];

const client = {
  async listProjects(
    options?: Parameters<BirdCoderAppSdkApiClient['listProjects']>[0],
  ): Promise<Awaited<ReturnType<BirdCoderAppSdkApiClient['listProjects']>>> {
    listProjectRequests.push({ workspaceId: options?.workspaceId });
    return remoteSummaries.filter(
      (projectSummary) =>
        !options?.workspaceId || projectSummary.workspaceId === options.workspaceId,
    );
  },
} as unknown as BirdCoderAppSdkApiClient;

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
  appClient: client,
  codingRuntimeClient: {
    async listCodingSessions() {
      return [];
    },
  } as unknown as BirdCoderAppRuntimeReadSdkApiClient,
  projectMirror: writeService,
  writeService,
});

const visibleProjects = await service.getProjects('workspace-selected');
const visibleSnapshots = await service.getProjectMirrorSnapshots('workspace-selected');

assert.deepEqual(
  visibleProjects.map((project) => project.id),
  ['project-imported-selected', 'project-remote-only-selected'],
  'project lists must show every authorized project in the selected workspace, including a remote project without a local mount.',
);
assert.deepEqual(
  visibleSnapshots.map((project) => project.id),
  ['project-imported-selected', 'project-remote-only-selected'],
  'project mirror snapshot inventory must show every authorized project in the selected workspace, including a remote project without a local mount.',
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
assert.equal(
  Object.hasOwn(
    visibleProjects.find((project) => project.id === remoteOnlySelectedProject.id) ?? {},
    'path',
  ),
  false,
  'an authorized remote project must remain visible without embedding a client-local path.',
);
assert.equal(
  Object.hasOwn(
    visibleSnapshots.find((project) => project.id === remoteOnlySelectedProject.id) ?? {},
    'path',
  ),
  false,
  'an authorized remote project snapshot must remain visible without embedding a client-local path.',
);
assert.deepEqual(
  mirroredProjectIds,
  [
    'project-imported-selected',
    'project-remote-only-selected',
    'project-imported-selected',
    'project-remote-only-selected',
  ],
  'project list reads must project every authorized selected-workspace project into the device-local mirror without using a local mount as an authorization gate.',
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
