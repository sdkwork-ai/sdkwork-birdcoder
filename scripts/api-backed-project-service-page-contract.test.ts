import assert from 'node:assert/strict';
import type {
  BirdCoderProject,
  BirdCoderProjectSummary,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { ApiBackedProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type { IProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IProjectService.ts';
import type {
  BirdCoderAppSdkApiClient,
  BirdCoderPage,
  BirdCoderProjectPageRequest,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';

interface ApiBackedProjectPageService {
  listProjectPage(
    input: BirdCoderProjectPageRequest,
  ): Promise<BirdCoderPage<BirdCoderProject>>;
}

const request: BirdCoderProjectPageRequest = {
  page: 2,
  pageSize: 20,
  workspaceId: 'workspace-api-backed-project-page',
};

const remoteProjectSummary: BirdCoderProjectSummary = {
  createdAt: '2026-07-10T00:00:00.000Z',
  description: 'A project supplied by the bounded authoritative page.',
  id: 'project-api-backed-page-21',
  name: 'Authoritative Project 21',
  status: 'active',
  updatedAt: '2026-07-10T00:00:01.000Z',
  workspaceId: request.workspaceId!,
};

const remotePage: BirdCoderPage<BirdCoderProjectSummary> = {
  items: [remoteProjectSummary],
  pageInfo: {
    hasMore: true,
    mode: 'offset',
    page: 2,
    pageSize: 20,
    totalItems: '41',
    totalPages: 3,
  },
};

const receivedPageRequests: BirdCoderProjectPageRequest[] = [];
let broadLocalProjectReads = 0;
let localMirrorSnapshotReads = 0;
let projectDetailReads = 0;
let localPageReads = 0;
let mirrorSyncCalls = 0;

const appClient = {
  async listProjectPage(
    input: BirdCoderProjectPageRequest,
  ): Promise<BirdCoderPage<BirdCoderProjectSummary>> {
    receivedPageRequests.push(structuredClone(input));
    return structuredClone(remotePage);
  },
  async listProjects(): Promise<never> {
    throw new Error('listProjects must not be used by the bounded project page path.');
  },
  async getProject(): Promise<never> {
    projectDetailReads += 1;
    throw new Error('getProject must not be used by the bounded project page path.');
  },
} as unknown as BirdCoderAppSdkApiClient;

const writeService = {
  async getProjects(): Promise<never> {
    broadLocalProjectReads += 1;
    throw new Error('getProjects must not be used by the bounded project page path.');
  },
  async getProjectMirrorSnapshots(): Promise<never> {
    localMirrorSnapshotReads += 1;
    throw new Error('getProjectMirrorSnapshots must not be used by the bounded project page path.');
  },
  async getProjectsPage(): Promise<never> {
    localPageReads += 1;
    throw new Error('getProjectsPage must not be used on a successful remote page.');
  },
} as unknown as IProjectService;

const service = new ApiBackedProjectService({
  appClient,
  projectMirror: {
    async syncProjectSummary() {
      mirrorSyncCalls += 1;
      throw new Error('remote page must not synchronize each item into the local mirror');
    },
  },
  writeService,
}) as ApiBackedProjectService & ApiBackedProjectPageService;

const projectPage = await service.listProjectPage(request);

assert.deepEqual(
  receivedPageRequests,
  [request],
  'the SDK page facade must make one semantic app-client page request with the original standard page query.',
);
receivedPageRequests.length = 0;

const boundedProjectPage = await service.getProjectsPage(
  request.workspaceId,
  request,
);

assert.deepEqual(
  receivedPageRequests,
  [request],
  'the API-backed service must make one semantic app-client page request with the original standard page query.',
);
assert.equal(
  broadLocalProjectReads,
  0,
  'the API-backed service page path must not call the broad local getProjects inventory API.',
);
assert.equal(
  localMirrorSnapshotReads,
  0,
  'the API-backed service page path must not call the broad local mirror snapshot API.',
);
assert.equal(
  projectDetailReads,
  0,
  'the API-backed project page path must not issue one project-detail read per remote item.',
);
assert.equal(
  localPageReads,
  0,
  'the API-backed project page path must not read the local page when the remote page succeeds.',
);
assert.equal(
  mirrorSyncCalls,
  0,
  'the API-backed project page path must not perform one local mirror synchronization per remote item.',
);
assert.deepEqual(
  projectPage.pageInfo,
  remotePage.pageInfo,
  'the API-backed service page path must retain the complete standard offset PageInfo.',
);
assert.deepEqual(
  projectPage.items.map((project) => ({
    archived: project.archived,
    codingSessions: project.codingSessions,
    id: project.id,
    name: project.name,
    workspaceId: project.workspaceId,
  })),
  [
    {
      archived: false,
      codingSessions: [],
      id: remoteProjectSummary.id,
      name: remoteProjectSummary.name,
      workspaceId: remoteProjectSummary.workspaceId,
    },
  ],
  'the API-backed service page path must expose a project inventory page without loading local project or transcript inventories.',
);
assert.equal(
  Object.hasOwn(projectPage.items[0]!, 'path'),
  false,
  'the remote project inventory must not expose a device-private working directory.',
);
assert.equal(
  Object.hasOwn(projectPage.items[0]!, 'sitePath'),
  false,
  'the remote project inventory must not expose a device-private site path.',
);
assert.deepEqual(
  boundedProjectPage.pageInfo,
  remotePage.pageInfo,
  'getProjectsPage must retain the complete authoritative PageInfo after mapping remote summaries.',
);
assert.deepEqual(
  boundedProjectPage.items.map((project) => project.id),
  [remoteProjectSummary.id],
  'getProjectsPage must expose every authorized remote item without local-id filtering.',
);

console.log('api backed project service page contract passed.');
