import assert from 'node:assert/strict';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import { ApiBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type { IProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IProjectService.ts';

const localProject: BirdCoderProject = {
  id: 'project-local-stale',
  workspaceId: 'workspace-1',
  name: 'Imported local project',
  description: 'Local mirror should not be treated as authoritative when the remote API says the path is absent.',
  path: 'D:\\repos\\birdcoder',
  createdAt: '2026-04-23T10:00:00.000Z',
  updatedAt: '2026-04-23T10:30:00.000Z',
  codingSessions: [],
};

let capturedUserId: string | undefined;

const client = {
  async listProjects(
    options?: Parameters<BirdCoderAppAdminApiClient['listProjects']>[0],
  ): Promise<Awaited<ReturnType<BirdCoderAppAdminApiClient['listProjects']>>> {
    capturedUserId = options?.userId;
    return [];
  },
} as unknown as BirdCoderAppAdminApiClient;

const writeService = {
  async getProjectByPath(): Promise<BirdCoderProject | null> {
    return structuredClone(localProject);
  },
} as unknown as IProjectService;

const service = new ApiBackedProjectService({
  client,
  identityProvider: {
    async getCurrentUser() {
      throw new Error(
        'BirdCoder API request failed: GET /api/app/v1/user/profile -> 404',
      );
    },
  },
  writeService,
});

const resolvedProject = await service.getProjectByPath(
  'workspace-1',
  'D:\\repos\\birdcoder',
);

assert.equal(
  capturedUserId,
  undefined,
  'project lookup must continue without an identity filter when current-user resolution is unavailable.',
);
assert.equal(
  resolvedProject,
  null,
  'project import must not reuse a local-only mirrored project when the authoritative API reports no matching project path.',
);

console.log('api backed project service import authority contract passed.');
