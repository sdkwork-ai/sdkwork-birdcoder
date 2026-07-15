import type { BirdCoderAppSdkApiClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';
import type {
  BirdCoderProject,
} from '@sdkwork/birdcoder-pc-types';
import { ApiBackedProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type {
  CreateProjectOptions,
  IProjectService,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IProjectService.ts';

const createdAt = '2026-04-23T14:00:00.000Z';
const remoteProject = {
  id: 'project-authoritative-create',
  workspaceId: 'workspace-1',
  name: 'Authoritative project [project-authoritative-create]',
  title: 'Authoritative project',
  status: 'active',
  createdAt,
  updatedAt: createdAt,
} satisfies Awaited<ReturnType<BirdCoderAppSdkApiClient['createProject']>>;

let capturedEvidenceSnapshot:
  | Pick<BirdCoderProject, 'createdAt' | 'id' | 'updatedAt'>
  | undefined;
let evidenceCallCount = 0;

const writeService = {
  async recordProjectCreationEvidence(
    _projectId: string,
    _options?: CreateProjectOptions,
    projectSnapshot?: Pick<BirdCoderProject, 'createdAt' | 'id' | 'updatedAt'>,
  ): Promise<void> {
    evidenceCallCount += 1;
    capturedEvidenceSnapshot = projectSnapshot;
    if (!projectSnapshot) {
      throw new Error('expected project snapshot');
    }
  },
} as IProjectService;

const service = new ApiBackedProjectService({
  appClient: {
    async createProject() {
      return remoteProject;
    },
  } as unknown as BirdCoderAppSdkApiClient,
  writeService,
});

const project = await service.createProject('workspace-1', 'Authoritative project');

assert.equal(evidenceCallCount, 1);
assert.ok(capturedEvidenceSnapshot);
assert.equal(capturedEvidenceSnapshot.id, 'project-authoritative-create');
assert.equal(capturedEvidenceSnapshot.createdAt, createdAt);
assert.equal(capturedEvidenceSnapshot.updatedAt, createdAt);
assert.equal(Object.hasOwn(capturedEvidenceSnapshot, 'path'), false);
assert.equal(project.id, 'project-authoritative-create');
assert.equal(
  project.name,
  'Authoritative project',
  'api-backed project service must expose project title as the UI display name while studio_project.name remains a unique business key.',
);

const resilientService = new ApiBackedProjectService({
  appClient: {
    async createProject() {
      return remoteProject;
    },
  } as unknown as BirdCoderAppSdkApiClient,
  writeService: {
    async recordProjectCreationEvidence(
      _projectId: string,
      _options?: CreateProjectOptions,
      projectSnapshot?: Pick<BirdCoderProject, 'createdAt' | 'id' | 'updatedAt'>,
    ): Promise<void> {
      assert.ok(projectSnapshot);
      throw new Error('simulated evidence persistence failure');
    },
  } as unknown as IProjectService,
});

const resilientProject = await resilientService.createProject(
  'workspace-1',
  'Authoritative project',
);

assert.equal(
  resilientProject.id,
  'project-authoritative-create',
  'project creation must stay successful even when optional project-creation evidence recording fails.',
);

console.log('api backed project service create project evidence contract passed.');
