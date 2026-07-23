import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type {
  BirdCoderProject,
  BirdCoderProjectSummary,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { ApiBackedProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type { IProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IProjectService.ts';
import type {
  BirdCoderAppRuntimeReadSdkApiClient,
  BirdCoderAppSdkApiClient,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';

const workspaceId = 'workspace-authorized-catalog-no-delete';

function createLocalProject(id: string): BirdCoderProject {
  return {
    id,
    workspaceId,
    name: `Authorized project ${id}`,
    description: 'Server-authorized projects remain independent from local device mounts.',
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
    agentSessions: [],
  };
}

function createRemoteSummary(project: BirdCoderProject): BirdCoderProjectSummary {
  return {
    id: project.id,
    workspaceId: project.workspaceId,
    name: project.name,
    description: project.description,
    status: 'active',
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

const localProjects = [
  createLocalProject('project-authorized-catalog-one'),
  createLocalProject('project-authorized-catalog-two'),
];
const remoteSummaries = localProjects.map(createRemoteSummary);
let remoteDeleteCalls = 0;
let localDeleteCalls = 0;

const appClient = {
  async listProjects(
    options?: Parameters<BirdCoderAppSdkApiClient['listProjects']>[0],
  ): Promise<Awaited<ReturnType<BirdCoderAppSdkApiClient['listProjects']>>> {
    assert.equal(options?.workspaceId, workspaceId);
    return structuredClone(remoteSummaries);
  },
  async deleteProject(): Promise<void> {
    remoteDeleteCalls += 1;
  },
} as unknown as BirdCoderAppSdkApiClient;

const writeService = {
  async getProjects(candidateWorkspaceId?: string): Promise<BirdCoderProject[]> {
    assert.equal(candidateWorkspaceId, workspaceId);
    return structuredClone(localProjects);
  },
  async deleteProject(): Promise<void> {
    localDeleteCalls += 1;
  },
} as unknown as IProjectService;

const service = new ApiBackedProjectService({
  appClient,
  codingRuntimeClient: {
    async listAgentSessions() {
      return [];
    },
  } as unknown as BirdCoderAppRuntimeReadSdkApiClient,
  writeService,
});

const projects = await service.getProjects(workspaceId);

assert.deepEqual(
  projects.map((project) => project.id).sort(),
  localProjects.map((project) => project.id).sort(),
  'the authorized catalog must retain every server-authorized project without client-side duplicate cleanup.',
);
assert.equal(
  remoteDeleteCalls,
  0,
  'reading the authorized project catalog must never issue a client-side remote delete request.',
);
assert.equal(
  localDeleteCalls,
  0,
  'reading the authorized project catalog must never delete a device-local mirror.',
);

const source = await readFile(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts',
    import.meta.url,
  ),
  'utf8',
);
const getProjectsStart = source.indexOf('  async getProjects(');
const getProjectsEnd = source.indexOf('\n  async getProjectsPage(', getProjectsStart);
assert.notEqual(getProjectsStart, -1, 'ApiBackedProjectService must implement getProjects.');
assert.notEqual(getProjectsEnd, -1, 'ApiBackedProjectService must delimit getProjects before pagination.');
const getProjectsSource = source.slice(getProjectsStart, getProjectsEnd);

assert.doesNotMatch(
  getProjectsSource,
  /collectRedundantDuplicateProjectIds|deleteProject\(redundantProjectId\)/u,
  'authorized catalog reads must not reintroduce path-based duplicate cleanup or client-side deletion.',
);
assert.doesNotMatch(
  getProjectsSource,
  /localProjectsById\.has\(projectSummary\.id\)/u,
  'authorized catalog visibility must not require a matching local project mirror.',
);

console.log('api-backed project service authorized catalog no-delete contract passed.');
