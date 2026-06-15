import type { BirdCoderAppSdkApiClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';
import type {
  BirdCoderProject,
} from '@sdkwork/birdcoder-pc-types';
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
  description: 'Local mirror should not be treated as authoritative when the remote API says the path is absent.',
  path: 'D:\\repos\\birdcoder',
  createdAt: '2026-04-23T10:00:00.000Z',
  updatedAt: '2026-04-23T10:30:00.000Z',
  codingSessions: [],
};

let capturedUserId: string | undefined;

const client = {
  async listProjects(
    options?: Parameters<BirdCoderAppSdkApiClient['listProjects']>[0],
  ): Promise<Awaited<ReturnType<BirdCoderAppSdkApiClient['listProjects']>>> {
    capturedUserId = options?.userId;
    return [];
  },
} as unknown as BirdCoderAppSdkApiClient;

const writeService = {
  async getProjectByPath(): Promise<BirdCoderProject | null> {
    return structuredClone(localProject);
  },
} as unknown as IProjectService;

const service = new ApiBackedProjectService({
  appClient: client,
  currentUserProvider: {
    async getCurrentUser() {
      throw new Error(
        'BirdCoder API request failed: GET /app/v3/api/iam/users/current -> 404',
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
