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
} as BirdCoderAppAdminApiClient;

const writeService = {
  async getProjects(): Promise<BirdCoderProject[]> {
    return [structuredClone(localProject)];
  },
} as IProjectService;

const service = new ApiBackedProjectService({
  client,
  writeService,
});

const visibleProjects = await service.getProjects('workspace-1');
const visibleMirrorSnapshots = await service.getProjectMirrorSnapshots('workspace-1');

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

console.log('api backed project service project path contract passed.');
