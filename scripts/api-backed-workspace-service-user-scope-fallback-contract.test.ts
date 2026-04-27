import assert from 'node:assert/strict';
import type {
  BirdCoderAppAdminApiClient,
  IWorkspace,
} from '@sdkwork/birdcoder-types';
import { ApiBackedWorkspaceService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedWorkspaceService.ts';
import type { IWorkspaceService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IWorkspaceService.ts';

function createLocalWorkspace(
  id: string,
  ownerId: string,
  name: string,
): IWorkspace {
  return {
    id,
    name,
    description: `${name} local fallback fixture.`,
    ownerId,
    leaderId: ownerId,
    createdByUserId: ownerId,
    status: 'active',
  };
}

const userAWorkspace = createLocalWorkspace(
  'workspace-user-a',
  'user-a',
  'User A workspace',
);
const userBWorkspace = createLocalWorkspace(
  'workspace-user-b',
  'user-b',
  'User B workspace',
);

const service = new ApiBackedWorkspaceService({
  client: {
    async listWorkspaces(): Promise<Awaited<ReturnType<BirdCoderAppAdminApiClient['listWorkspaces']>>> {
      throw new Error('Failed to fetch workspace catalog');
    },
  } as unknown as BirdCoderAppAdminApiClient,
  identityProvider: {
    async getCurrentUser() {
      return {
        id: 'user-b',
        name: 'User B',
        email: 'user-b@example.com',
      };
    },
  },
  writeService: {
    async getWorkspaces(): Promise<IWorkspace[]> {
      return [
        structuredClone(userAWorkspace),
        structuredClone(userBWorkspace),
      ];
    },
  } as unknown as IWorkspaceService,
});

const originalConsoleWarn = console.warn;
console.warn = () => {};

try {
  const fallbackWorkspaces = await service.getWorkspaces();

  assert.deepEqual(
    fallbackWorkspaces.map((workspace) => workspace.id),
    ['workspace-user-b'],
    'workspace catalog transient fallback must not expose locally mirrored workspaces owned by another authenticated user.',
  );
} finally {
  console.warn = originalConsoleWarn;
}

console.log('api backed workspace service user-scope fallback contract passed.');
