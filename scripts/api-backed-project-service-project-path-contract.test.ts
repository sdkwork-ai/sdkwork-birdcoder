import assert from 'node:assert/strict';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import { ApiBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type { IProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IProjectService.ts';

const localProject: BirdCoderProject = {
  id: 'project-local-path',
  workspaceId: 'workspace-1',
  name: 'Imported local project',
  description: 'Locally imported project path should survive remote summary merges.',
  path: 'D:\\repos\\birdcoder',
  createdAt: '2026-04-16T10:00:00.000Z',
  updatedAt: '2026-04-16T10:30:00.000Z',
  codingSessions: [],
};

const client = {
  async listProjects(): Promise<Awaited<ReturnType<BirdCoderAppAdminApiClient['listProjects']>>> {
    return [
      {
        id: 'project-local-path',
        workspaceId: 'workspace-1',
        name: 'Imported local project',
        description: 'Remote summary is missing the imported root path.',
        rootPath: '',
        status: 'active',
        createdAt: '2026-04-16T10:00:00.000Z',
        updatedAt: '2026-04-16T10:30:00.000Z',
      },
    ];
  },
  async getProject(): Promise<Awaited<ReturnType<BirdCoderAppAdminApiClient['getProject']>>> {
    return {
      id: 'project-local-path',
      workspaceId: 'workspace-1',
      name: 'Imported local project',
      description: 'Remote detail is missing the imported root path.',
      rootPath: '',
      status: 'active',
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:30:00.000Z',
    };
  },
} as unknown as BirdCoderAppAdminApiClient;

const writeService = {
  async getProjects(): Promise<BirdCoderProject[]> {
    return [structuredClone(localProject)];
  },
  async getProjectById(): Promise<BirdCoderProject | null> {
    return structuredClone(localProject);
  },
  async getProjectByPath(): Promise<BirdCoderProject | null> {
    return structuredClone(localProject);
  },
} as unknown as IProjectService;

const service = new ApiBackedProjectService({
  client,
  writeService,
});

const visibleProjects = await service.getProjects('workspace-1');
const visibleMirrorSnapshots = await service.getProjectMirrorSnapshots('workspace-1');
const visibleProjectById = await service.getProjectById('project-local-path');
const visibleProjectByPath = await service.getProjectByPath(
  'workspace-1',
  'D:\\repos\\birdcoder',
);

assert.equal(
  visibleProjects[0]?.path,
  'D:\\repos\\birdcoder',
  'api-backed project queries must preserve the local imported project path when the remote summary omits rootPath.',
);
assert.equal(
  visibleMirrorSnapshots[0]?.path,
  'D:\\repos\\birdcoder',
  'api-backed mirror snapshots must preserve the local imported project path so native Codex session attribution can still match by cwd.',
);
assert.equal(
  visibleProjectById?.path,
  'D:\\repos\\birdcoder',
  'api-backed project detail reads must preserve the local imported project path when the remote detail omits rootPath.',
);
assert.equal(
  visibleProjectByPath?.path,
  'D:\\repos\\birdcoder',
  'api-backed project path lookup must preserve the local imported project path when the remote lookup omits rootPath.',
);

console.log('api backed project service project path contract passed.');
