import assert from 'node:assert/strict';
import type {
  BirdCoderAppRuntimeReadSdkApiClient,
  BirdCoderAppSdkApiClient,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import { ApiBackedProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type {
  BirdCoderCodingSessionSummary,
  BirdCoderProject,
  BirdCoderProjectSummary,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';
import type { IProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IProjectService.ts';

const workspaceId = 'workspace-new-project-session-discovery';
const projectId = 'project-new-project-session-discovery';
const runtimeLocationId = 'runtime-new-project-session-discovery';

const projectSummary: BirdCoderProjectSummary = {
  createdAt: '2026-07-22T00:00:00.000Z',
  id: projectId,
  name: 'New project session discovery',
  status: 'active',
  updatedAt: '2026-07-22T00:00:00.000Z',
  workspaceId,
};

const localProject: BirdCoderProject = {
  codingSessions: [],
  createdAt: projectSummary.createdAt,
  id: projectId,
  name: projectSummary.name,
  updatedAt: projectSummary.updatedAt,
  workspaceId,
};

const discoveredSession: BirdCoderCodingSessionSummary = {
  createdAt: '2026-07-22T00:01:00.000Z',
  engineId: 'codex',
  hostMode: 'desktop',
  id: 'coding-session-discovered-for-new-project',
  modelId: 'gpt-5.4',
  nativeSessionId: 'provider-session-discovered-for-new-project',
  projectId,
  runtimeLocationId,
  status: 'active',
  title: 'Existing provider session',
  updatedAt: '2026-07-22T00:02:00.000Z',
  workspaceId,
};

let preferenceReads = 0;
let runtimeLocationReads = 0;
const codingSessionRequests: Array<{
  projectId?: string;
  runtimeLocationId?: string;
  workspaceId?: string;
}> = [];

const appClient = {
  async getProject(candidateProjectId: string) {
    assert.equal(candidateProjectId, projectId);
    return projectSummary;
  },
  async getProjectRuntimeLocation(
    candidateProjectId: string,
    candidateRuntimeLocationId: string,
  ) {
    runtimeLocationReads += 1;
    assert.equal(candidateProjectId, projectId);
    assert.equal(candidateRuntimeLocationId, runtimeLocationId);
    return {
      id: runtimeLocationId,
      rootLocator: 'project-root',
      runtimeTargetId: 'desktop-target-1',
      version: '1',
    };
  },
  async listProjectRuntimeLocationPreferences(candidateProjectId: string) {
    preferenceReads += 1;
    assert.equal(candidateProjectId, projectId);
    return [
      {
        capability: 'terminal' as const,
        createdAt: projectSummary.createdAt,
        id: 'preference-terminal',
        projectId,
        runtimeLocationId,
        subjectUserId: 'user-1',
        updatedAt: projectSummary.updatedAt,
        version: '1',
      },
      {
        capability: 'file_system' as const,
        createdAt: projectSummary.createdAt,
        id: 'preference-file-system',
        projectId,
        runtimeLocationId: 'runtime-file-system-fallback',
        subjectUserId: 'user-1',
        updatedAt: projectSummary.updatedAt,
        version: '1',
      },
      {
        capability: 'git' as const,
        createdAt: projectSummary.createdAt,
        id: 'preference-git-is-not-a-discovery-authority',
        projectId,
        runtimeLocationId: 'runtime-git-only',
        subjectUserId: 'user-1',
        updatedAt: projectSummary.updatedAt,
        version: '1',
      },
    ];
  },
} as unknown as BirdCoderAppSdkApiClient;

const codingRuntimeClient = {
  async listCodingSessions(request?: {
    projectId?: string;
    runtimeLocationId?: string;
    workspaceId?: string;
  }) {
    codingSessionRequests.push({ ...request });
    return [discoveredSession];
  },
} as unknown as BirdCoderAppRuntimeReadSdkApiClient;

const writeService = {
  async getProjectById(candidateProjectId: string) {
    return candidateProjectId === projectId
      ? structuredClone(localProject)
      : null;
  },
  async getProjects(candidateWorkspaceId?: string) {
    return candidateWorkspaceId === workspaceId
      ? [structuredClone(localProject)]
      : [];
  },
} as unknown as IProjectService;

const service = new ApiBackedProjectService({
  appClient,
  codingRuntimeClient,
  writeService,
});

const project = await service.getProjectById(projectId);

assert.equal(preferenceReads, 1);
assert.equal(runtimeLocationReads, 1);
assert.deepEqual(codingSessionRequests, [
  {
    projectId,
    runtimeLocationId,
    workspaceId,
  },
]);
assert.equal(
  project?.codingSessions[0]?.id,
  discoveredSession.id,
  'A new project with no local sessions must discover provider history through its verified runtime-location preference.',
);

console.log('api-backed new-project coding-session discovery contract passed.');
