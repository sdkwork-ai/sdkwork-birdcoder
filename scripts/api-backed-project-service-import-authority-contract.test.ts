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

const serviceSource = await import('node:fs/promises').then((fs) => fs.readFile(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts',
    import.meta.url,
  ),
  'utf8',
));
const currentUserScopeSource = await import('node:fs/promises').then((fs) => fs.readFile(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/currentUserScope.ts',
    import.meta.url,
  ),
  'utf8',
));

assert.doesNotMatch(
  currentUserScopeSource,
  /\/app\/v3\/api\/auth\/session(?:['"`\)]|$)/u,
  'CurrentUserScopeResolver must not match retired singular /auth/session errors; use canonical /auth/sessions/current.',
);
assert.match(
  currentUserScopeSource,
  /\/app\/v3\/api\/auth\/sessions\/current/u,
  'CurrentUserScopeResolver optional IAM fallback must recognize the canonical current-session path.',
);
assert.match(
  serviceSource,
  /CurrentUserScopeResolver/u,
  'ApiBackedProjectService must use the shared current-user scope resolver instead of duplicating IAM fallback rules.',
);

const localProject: BirdCoderProject = {
  id: 'project-local-stale',
  workspaceId: 'workspace-1',
  name: 'Imported local project',
  description: 'A stale local mirror must not control the authorized remote catalog.',
  path: 'D:\\repos\\birdcoder',
  createdAt: '2026-04-23T10:00:00.000Z',
  updatedAt: '2026-04-23T10:30:00.000Z',
  codingSessions: [],
};

const authorizedRootlessProject: BirdCoderProjectSummary = {
  id: 'project-authorized-rootless',
  workspaceId: 'workspace-1',
  name: 'Authorized rootless project',
  description: 'The remote catalog authorizes this project before a device mount exists.',
  status: 'active',
  createdAt: '2026-04-23T10:00:00.000Z',
  updatedAt: '2026-04-23T10:30:00.000Z',
} as BirdCoderProjectSummary;

let capturedUserId: string | undefined;

const client = {
  async listProjects(
    options?: Parameters<BirdCoderAppSdkApiClient['listProjects']>[0],
  ): Promise<Awaited<ReturnType<BirdCoderAppSdkApiClient['listProjects']>>> {
    capturedUserId = options?.userId;
    return [authorizedRootlessProject];
  },
} as unknown as BirdCoderAppSdkApiClient;

const writeService = {
  async getProjects(): Promise<BirdCoderProject[]> {
    return [structuredClone(localProject)];
  },
} as unknown as IProjectService;

const service = new ApiBackedProjectService({
  appClient: client,
  codingRuntimeClient: {
    async listCodingSessions() {
      return [];
    },
  } as unknown as BirdCoderAppRuntimeReadSdkApiClient,
  currentUserProvider: {
    async getCurrentUser() {
      throw new Error(
        'BirdCoder API request failed: GET /app/v3/api/iam/users/current -> 404',
      );
    },
  },
  writeService,
});

const resolvedProjects = await service.getProjects('workspace-1');

assert.equal(
  capturedUserId,
  undefined,
  'authorized project listing must continue without an identity filter when current-user resolution is unavailable.',
);
assert.deepEqual(
  resolvedProjects.map((project) => project.id),
  [authorizedRootlessProject.id],
  'the authoritative catalog must determine visible projects even when the device has only a stale unrelated local mirror.',
);
assert.equal(
  resolvedProjects[0]?.path,
  undefined,
  'an authorized remote project without a device mount must not receive a fabricated local path.',
);

console.log('api-backed project service import authority contract passed.');
