import type { BirdCoderAppSdkApiClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';
import type {
  BirdCoderProject,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { ApiBackedProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type { IProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IProjectService.ts';

function createLocalProject(
  id: string,
  userId: string,
  name: string,
): BirdCoderProject {
  return {
    id,
    workspaceId: 'workspace-1',
    name,
    description: `${name} local fallback fixture.`,
    userId,
    ownerId: userId,
    createdByUserId: userId,
    author: userId,
    createdAt: '2026-04-25T10:00:00.000Z',
    updatedAt: '2026-04-25T10:00:00.000Z',
    agentSessions: [],
  };
}

const userAProject = createLocalProject(
  'project-user-a',
  'user-a',
  'User A project',
);
const userBProject = createLocalProject(
  'project-user-b',
  'user-b',
  'User B project',
);

let boundedPageReads = 0;
const client = {
  async listProjects(): Promise<Awaited<ReturnType<BirdCoderAppSdkApiClient['listProjects']>>> {
    throw new Error('Failed to fetch project catalog');
  },
  async getProject(): Promise<Awaited<ReturnType<BirdCoderAppSdkApiClient['getProject']>>> {
    throw new Error('Failed to fetch project detail');
  },
  async listProjectPage(): Promise<never> {
    throw new Error('Failed to fetch project page');
  },
} as unknown as BirdCoderAppSdkApiClient;

const writeService = {
  async getProjects(): Promise<BirdCoderProject[]> {
    return [
      structuredClone(userAProject),
      structuredClone(userBProject),
    ];
  },
  async getProjectById(projectId: string): Promise<BirdCoderProject | null> {
    if (projectId === userAProject.id) {
      return structuredClone(userAProject);
    }
    if (projectId === userBProject.id) {
      return structuredClone(userBProject);
    }
    return null;
  },
  async getProjectsPage() {
    boundedPageReads += 1;
    return {
      items: [structuredClone(userAProject), structuredClone(userBProject)],
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
} as unknown as IProjectService;

const service = new ApiBackedProjectService({
  appClient: client,
  currentUserProvider: {
    async getCurrentUser() {
      return {
        id: 'user-b',
        name: 'User B',
        email: 'user-b@example.com',
      };
    },
  },
  writeService,
});

const originalConsoleWarn = console.warn;
console.warn = () => {};

try {
  const fallbackProjects = await service.getProjects('workspace-1');
  assert.deepEqual(
    fallbackProjects.map((project) => project.id),
    ['project-user-b'],
    'project catalog transient fallback must not expose locally mirrored projects owned by another authenticated user.',
  );

  const fallbackSnapshots = await service.getProjectMirrorSnapshots('workspace-1');
  assert.deepEqual(
    fallbackSnapshots.map((project) => project.id),
    ['project-user-b'],
    'project mirror snapshot fallback must remain scoped to the current authenticated user.',
  );

  const fallbackPage = await service.getProjectsPage('workspace-1', {
    page: 1,
    pageSize: 2,
  });
  assert.deepEqual(
    fallbackPage.items.map((project) => project.id),
    ['project-user-b'],
    'project page transient fallback must filter a mixed local page to the current authenticated user.',
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
    'project page transient fallback must rebuild PageInfo after removing another user\'s local record.',
  );
  assert.equal(
    boundedPageReads,
    1,
    'project page transient fallback must use one bounded local page read instead of broad inventory collection.',
  );

  assert.equal(
    await service.getProjectById('project-user-a'),
    null,
    'project detail transient fallback must not return another user local project from a stale selected id.',
  );
  const userBDetail = await service.getProjectById('project-user-b');
  assert.equal(
    userBDetail?.id,
    'project-user-b',
    'project detail transient fallback may use the current user local mirror.',
  );
} finally {
  console.warn = originalConsoleWarn;
}

let anonymousLocalPageReads = 0;
const anonymousService = new ApiBackedProjectService({
  appClient: {
    async listProjectPage(): Promise<never> {
      throw new Error('Failed to fetch anonymous project page');
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
    async getProjectsPage() {
      anonymousLocalPageReads += 1;
      return {
        items: [structuredClone(userAProject)],
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
  } as unknown as IProjectService,
});

console.warn = () => {};
try {
  const anonymousPage = await anonymousService.getProjectsPage('workspace-1', {
    page: 1,
    pageSize: 20,
  });
  assert.deepEqual(
    anonymousPage.items,
    [],
    'project page transient fallback must fail closed when current-user scope cannot be resolved.',
  );
  assert.equal(
    anonymousLocalPageReads,
    0,
    'project page transient fallback must not read local mirrors for anonymous or unresolved scope.',
  );
} finally {
  console.warn = originalConsoleWarn;
}

console.log('api backed project service user-scope fallback contract passed.');
