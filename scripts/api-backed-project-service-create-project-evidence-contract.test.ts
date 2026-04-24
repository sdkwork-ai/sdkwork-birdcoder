import assert from 'node:assert/strict';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import { ApiBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type {
  CreateProjectOptions,
  IProjectService,
} from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IProjectService.ts';

const createdAt = '2026-04-23T14:00:00.000Z';
const remoteProject = {
  id: 'project-authoritative-create',
  workspaceId: 'workspace-1',
  name: 'Authoritative project',
  rootPath: 'D:\\repos\\birdcoder',
  status: 'active',
  createdAt,
  updatedAt: createdAt,
} satisfies Awaited<ReturnType<BirdCoderAppAdminApiClient['createProject']>>;

let capturedEvidenceSnapshot:
  | Pick<BirdCoderProject, 'createdAt' | 'id' | 'path' | 'updatedAt'>
  | undefined;
let evidenceCallCount = 0;

const writeService = {
  async recordProjectCreationEvidence(
    _projectId: string,
    _options?: CreateProjectOptions,
    projectSnapshot?: Pick<BirdCoderProject, 'createdAt' | 'id' | 'path' | 'updatedAt'>,
  ): Promise<void> {
    evidenceCallCount += 1;
    capturedEvidenceSnapshot = projectSnapshot;
    if (!projectSnapshot) {
      throw new Error('expected project snapshot');
    }
  },
} as IProjectService;

const service = new ApiBackedProjectService({
  client: {
    async createProject() {
      return remoteProject;
    },
  } as unknown as BirdCoderAppAdminApiClient,
  writeService,
});

const project = await service.createProject('workspace-1', 'Authoritative project', {
  path: 'D:\\repos\\birdcoder',
});

assert.equal(evidenceCallCount, 1);
assert.ok(capturedEvidenceSnapshot);
assert.equal(capturedEvidenceSnapshot.id, 'project-authoritative-create');
assert.equal(capturedEvidenceSnapshot.createdAt, createdAt);
assert.equal(capturedEvidenceSnapshot.updatedAt, createdAt);
assert.equal(capturedEvidenceSnapshot.path, 'D:\\repos\\birdcoder');
assert.equal(project.id, 'project-authoritative-create');

const resilientService = new ApiBackedProjectService({
  client: {
    async createProject() {
      return remoteProject;
    },
  } as unknown as BirdCoderAppAdminApiClient,
  writeService: {
    async recordProjectCreationEvidence(
      _projectId: string,
      _options?: CreateProjectOptions,
      projectSnapshot?: Pick<BirdCoderProject, 'createdAt' | 'id' | 'path' | 'updatedAt'>,
    ): Promise<void> {
      assert.ok(projectSnapshot);
      throw new Error('simulated evidence persistence failure');
    },
  } as unknown as IProjectService,
});

const resilientProject = await resilientService.createProject(
  'workspace-1',
  'Authoritative project',
  {
    path: 'D:\\repos\\birdcoder',
  },
);

assert.equal(
  resilientProject.id,
  'project-authoritative-create',
  'project creation must stay successful even when optional project-creation evidence recording fails.',
);

console.log('api backed project service create project evidence contract passed.');
