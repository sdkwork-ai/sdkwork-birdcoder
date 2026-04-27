import assert from 'node:assert/strict';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import { ApiBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type { IProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IProjectService.ts';

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
    path: `D:\\repos\\${id}`,
    userId,
    ownerId: userId,
    createdByUserId: userId,
    author: userId,
    createdAt: '2026-04-25T10:00:00.000Z',
    updatedAt: '2026-04-25T10:00:00.000Z',
    codingSessions: [],
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

const client = {
  async listProjects(): Promise<Awaited<ReturnType<BirdCoderAppAdminApiClient['listProjects']>>> {
    throw new Error('Failed to fetch project catalog');
  },
  async getProject(): Promise<Awaited<ReturnType<BirdCoderAppAdminApiClient['getProject']>>> {
    throw new Error('Failed to fetch project detail');
  },
} as unknown as BirdCoderAppAdminApiClient;

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
  async getProjectByPath(_workspaceId: string, projectPath: string): Promise<BirdCoderProject | null> {
    if (projectPath === userAProject.path) {
      return structuredClone(userAProject);
    }
    if (projectPath === userBProject.path) {
      return structuredClone(userBProject);
    }
    return null;
  },
} as unknown as IProjectService;

const service = new ApiBackedProjectService({
  client,
  identityProvider: {
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

  assert.equal(
    await service.getProjectById('project-user-a'),
    null,
    'project detail transient fallback must not return another user local project from a stale selected id.',
  );
  assert.equal(
    await service.getProjectByPath('workspace-1', userAProject.path),
    null,
    'project path transient fallback must not return another user local project from a stale path.',
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

console.log('api backed project service user-scope fallback contract passed.');
