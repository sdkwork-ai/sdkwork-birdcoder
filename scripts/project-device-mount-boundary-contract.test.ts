import assert from 'node:assert/strict';
import fs from 'node:fs';

import { ApiBackedProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import { ProviderBackedProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ProviderBackedProjectService.ts';
import { createBirdCoderConsoleQueries } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/consoleQueries.ts';
import type { BirdCoderAppSdkApiClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import type { IProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IProjectService.ts';
import { createBirdCoderConsoleRepositories } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/appConsoleRepository.ts';
import { createBirdCoderStorageProvider } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/dataKernel.ts';

const infrastructureRoot =
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src';
const projectBoundarySources = [
  `${infrastructureRoot}/services/consoleQueries.ts`,
  `${infrastructureRoot}/services/impl/ProviderBackedProjectService.ts`,
  `${infrastructureRoot}/services/impl/ApiBackedProjectService.ts`,
  `${infrastructureRoot}/storage/appConsoleRepository.ts`,
  `${infrastructureRoot}/services/interfaces/IProjectService.ts`,
];

for (const sourcePath of projectBoundarySources) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  assert.doesNotMatch(
    source,
    /\b(rootPath|sitePath|getProjectByPath)\b/u,
    `${sourcePath} must not reintroduce device-path fields into remote project metadata or service APIs.`,
  );
}

const storageProvider = createBirdCoderStorageProvider('sqlite');
const repositories = createBirdCoderConsoleRepositories({
  providerId: storageProvider.providerId,
  storage: storageProvider,
});
const queries = createBirdCoderConsoleQueries({ repositories });
const workspace = await queries.createWorkspace({
  name: 'Device Mount Boundary Workspace',
});
const consoleProject = await queries.createProject({
  workspaceId: workspace.id,
  name: 'Remote Project Identity',
  description: 'Remote metadata is independent from a device mount.',
});
assert.equal(Object.hasOwn(consoleProject, 'path'), false);
assert.equal(Object.hasOwn(consoleProject, 'sitePath'), false);
assert.equal((await repositories.projectContents.list()).length, 0);

const providerService = new ProviderBackedProjectService({
  repository: repositories.projects,
});
const providerProject = await providerService.createProject(
  workspace.id,
  'Standalone Project Identity',
  { description: 'The standalone mirror does not persist a local directory.' },
);
assert.equal(Object.hasOwn(providerProject, 'path'), false);
assert.equal(Object.hasOwn(providerProject, 'sitePath'), false);

let capturedCreateRequest: Record<string, unknown> | undefined;
let capturedUpdateRequest: Record<string, unknown> | undefined;
const apiBackedService = new ApiBackedProjectService({
  appClient: {
    async createProject(request) {
      capturedCreateRequest = { ...request };
      return {
        id: 'remote-project-identity',
        workspaceId: request.workspaceId,
        name: request.name,
        description: request.description,
        status: 'active',
        createdAt: '2026-07-14T00:00:00.000Z',
        updatedAt: '2026-07-14T00:00:00.000Z',
      };
    },
    async updateProject(projectId, request) {
      capturedUpdateRequest = { ...request };
      return {
        id: projectId,
        workspaceId: workspace.id,
        name: request.name ?? 'SDK Project Identity',
        description: request.description,
        status: request.status ?? 'active',
        createdAt: '2026-07-14T00:00:00.000Z',
        updatedAt: '2026-07-14T00:00:00.000Z',
      };
    },
  } as unknown as BirdCoderAppSdkApiClient,
  writeService: {} as IProjectService,
});
const remoteProject = await apiBackedService.createProject(
  workspace.id,
  'SDK Project Identity',
  { description: 'The composed SDK receives project metadata only.' },
);
assert.deepEqual(capturedCreateRequest, {
  workspaceId: workspace.id,
  name: 'SDK Project Identity',
  description: 'The composed SDK receives project metadata only.',
});
assert.equal(Object.hasOwn(remoteProject, 'path'), false);
assert.equal(Object.hasOwn(remoteProject, 'sitePath'), false);

await apiBackedService.updateProject(remoteProject.id, {
  name: 'Renamed SDK Project Identity',
  description: 'The remote project update only carries generated API fields.',
  status: 'archived',
});
assert.deepEqual(capturedUpdateRequest, {
  name: 'Renamed SDK Project Identity',
  description: 'The remote project update only carries generated API fields.',
  status: 'archived',
});

console.log('project device mount boundary contract passed.');
