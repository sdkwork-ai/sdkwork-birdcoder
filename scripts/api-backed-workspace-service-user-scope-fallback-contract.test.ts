import type { BirdCoderAppSdkApiClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';
import type {
  IWorkspace,
} from '@sdkwork/birdcoder-pc-types';
import { ApiBackedWorkspaceService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedWorkspaceService.ts';
import type { IWorkspaceService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IWorkspaceService.ts';

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

let boundedPageReads = 0;
const service = new ApiBackedWorkspaceService({
  appClient: {
    async listWorkspaces(): Promise<Awaited<ReturnType<BirdCoderAppSdkApiClient['listWorkspaces']>>> {
      throw new Error('Failed to fetch workspace catalog');
    },
    async listWorkspacePage(): Promise<never> {
      throw new Error('Failed to fetch workspace page');
    },
  } as unknown as BirdCoderAppSdkApiClient,
  currentUserProvider: {
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
    async getWorkspacesPage() {
      boundedPageReads += 1;
      return {
        items: [structuredClone(userAWorkspace), structuredClone(userBWorkspace)],
        pageInfo: {
          hasMore: false,
          mode: 'offset' as const,
          page: 1,
          pageSize: 2,
          totalItems: '2',
          totalPages: 1,
        },
      };
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

  const fallbackPage = await service.getWorkspacesPage({
    page: 1,
    pageSize: 2,
  });
  assert.deepEqual(
    fallbackPage.items.map((workspace) => workspace.id),
    ['workspace-user-b'],
    'workspace page transient fallback must filter a mixed local page to the current authenticated user.',
  );
  assert.deepEqual(
    fallbackPage.pageInfo,
    {
      hasMore: false,
      mode: 'offset',
      page: 1,
      pageSize: 2,
      totalItems: '1',
      totalPages: 1,
    },
    'workspace page transient fallback must rebuild PageInfo after removing another user\'s local record.',
  );
  assert.equal(
    boundedPageReads,
    1,
    'workspace page transient fallback must use one bounded local page read instead of broad inventory collection.',
  );
} finally {
  console.warn = originalConsoleWarn;
}

const cachedScopeCalls: string[] = [];
const cachedScopeService = new ApiBackedWorkspaceService({
  appClient: {
    async listWorkspaces(): Promise<Awaited<ReturnType<BirdCoderAppSdkApiClient['listWorkspaces']>>> {
      cachedScopeCalls.push('listWorkspaces');
      return [
        {
          id: 'workspace-cache-hit',
          uuid: 'workspace-cache-hit-uuid',
          tenantId: '0',
          name: 'Workspace cache hit',
          title: 'Workspace cache hit',
          ownerId: 'user-b',
          leaderId: 'user-b',
          createdByUserId: 'user-b',
          status: 'active',
        },
      ] as Awaited<ReturnType<BirdCoderAppSdkApiClient['listWorkspaces']>>;
    },
  } as unknown as BirdCoderAppSdkApiClient,
  currentUserProvider: {
    async getCurrentUser() {
      cachedScopeCalls.push('getCurrentUser');
      return {
        id: 'user-b',
        name: 'User B',
        email: 'user-b@example.com',
      };
    },
  },
  writeService: {
    async getWorkspaces(): Promise<IWorkspace[]> {
      cachedScopeCalls.push('getLocalWorkspaces');
      return [];
    },
  } as unknown as IWorkspaceService,
});

await cachedScopeService.getWorkspaces();
await cachedScopeService.getWorkspaces();
assert.equal(
  cachedScopeCalls.filter((call) => call === 'getCurrentUser').length,
  1,
  'workspace list cache hits must reuse the resolved current-user scope instead of reloading /iam/users/current before every cached read.',
);
assert.equal(
  cachedScopeCalls.filter((call) => call === 'listWorkspaces').length,
  1,
  'workspace list cache hits must still avoid repeating the remote workspace list request.',
);

const unavailableScopeService = new ApiBackedWorkspaceService({
  appClient: {
    async listWorkspaces(): Promise<Awaited<ReturnType<BirdCoderAppSdkApiClient['listWorkspaces']>>> {
      throw new Error('Failed to fetch workspace catalog');
    },
  } as unknown as BirdCoderAppSdkApiClient,
  currentUserProvider: {
    async getCurrentUser() {
      throw new Error(
        'BirdCoder API request timed out after 8000ms: GET /app/v3/api/iam/users/current',
      );
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

console.warn = () => {};
try {
  const fallbackWorkspaces = await unavailableScopeService.getWorkspaces();
  assert.deepEqual(
    fallbackWorkspaces,
    [],
    'workspace fallback must fail closed to an empty local mirror when current-user scope is unavailable, instead of throwing or exposing workspaces owned by another user.',
  );
} finally {
  console.warn = originalConsoleWarn;
}

let anonymousLocalPageReads = 0;
const anonymousPageService = new ApiBackedWorkspaceService({
  appClient: {
    async listWorkspacePage(): Promise<never> {
      throw new Error('Failed to fetch anonymous workspace page');
    },
  } as unknown as BirdCoderAppSdkApiClient,
  currentUserProvider: {
    async getCurrentUser() {
      throw new Error(
        'BirdCoder API request timed out after 8000ms: GET /app/v3/api/iam/users/current',
      );
    },
  },
  writeService: {
    async getWorkspacesPage() {
      anonymousLocalPageReads += 1;
      return {
        items: [structuredClone(userAWorkspace)],
        pageInfo: {
          hasMore: false,
          mode: 'offset' as const,
          page: 1,
          pageSize: 20,
          totalItems: '1',
          totalPages: 1,
        },
      };
    },
  } as unknown as IWorkspaceService,
});

console.warn = () => {};
try {
  const anonymousPage = await anonymousPageService.getWorkspacesPage({
    page: 1,
    pageSize: 20,
  });
  assert.deepEqual(
    anonymousPage.items,
    [],
    'workspace page transient fallback must fail closed when current-user scope cannot be resolved.',
  );
  assert.equal(
    anonymousLocalPageReads,
    0,
    'workspace page transient fallback must not read local mirrors for anonymous or unresolved scope.',
  );
} finally {
  console.warn = originalConsoleWarn;
}

console.log('api backed workspace service user-scope fallback contract passed.');
