import assert from 'node:assert/strict';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderCodingSessionSummary,
  BirdCoderCoreReadApiClient,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import { ApiBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type { IProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IProjectService.ts';

const workspaceId = 'workspace-authoritative-sessions';
const projectId = 'project-authoritative-sessions';
const codingSessionId = 'coding-session-authoritative-snapshot';

const localProject: BirdCoderProject = {
  id: projectId,
  workspaceId,
  name: 'Authoritative Session Project',
  description: 'Local mirror starts without session inventory after login.',
  path: 'D:/workspace/authoritative-session-project',
  createdAt: '2026-04-24T00:00:00.000Z',
  updatedAt: '2026-04-24T00:01:00.000Z',
  codingSessions: [],
};

const authoritativeCodingSession: BirdCoderCodingSessionSummary = {
  id: codingSessionId,
  workspaceId,
  projectId,
  title: 'Remote session should appear after login',
  status: 'active',
  hostMode: 'desktop',
  engineId: 'codex',
  modelId: 'gpt-5.4',
  nativeSessionId: 'authoritative-native-session',
  runtimeStatus: 'completed',
  createdAt: '2026-04-24T00:02:00.000Z',
  updatedAt: '2026-04-24T00:03:00.000Z',
  lastTurnAt: '2026-04-24T00:03:00.000Z',
  sortTimestamp: String(Date.parse('2026-04-24T00:03:00.000Z')),
  transcriptUpdatedAt: '2026-04-24T00:03:00.000Z',
};

let capturedSessionWorkspaceId: string | undefined;

const client = {
  async listProjects(
    options?: Parameters<BirdCoderAppAdminApiClient['listProjects']>[0],
  ): Promise<Awaited<ReturnType<BirdCoderAppAdminApiClient['listProjects']>>> {
    assert.equal(options?.workspaceId, workspaceId);
    return [
      {
        id: projectId,
        workspaceId,
        name: localProject.name,
        description: localProject.description,
        rootPath: localProject.path,
        status: 'active',
        createdAt: localProject.createdAt,
        updatedAt: localProject.updatedAt,
      },
    ];
  },
} as unknown as BirdCoderAppAdminApiClient;

const coreReadClient = {
  async listCodingSessions(
    request?: Parameters<BirdCoderCoreReadApiClient['listCodingSessions']>[0],
  ): Promise<BirdCoderCodingSessionSummary[]> {
    capturedSessionWorkspaceId = request?.workspaceId;
    return request?.workspaceId === workspaceId ? [authoritativeCodingSession] : [];
  },
} as unknown as BirdCoderCoreReadApiClient;

const writeService = {
  async getProjectMirrorSnapshots() {
    return [
      {
        ...localProject,
        codingSessions: [],
      },
    ];
  },
} as unknown as IProjectService;

const service = new ApiBackedProjectService({
  client,
  coreReadClient,
  writeService,
});

const snapshots = await service.getProjectMirrorSnapshots(workspaceId);

assert.equal(
  capturedSessionWorkspaceId,
  workspaceId,
  'mirror snapshot inventory must load authoritative coding sessions for the requested workspace.',
);
assert.equal(snapshots.length, 1);
assert.equal(snapshots[0]?.id, projectId);
assert.equal(
  snapshots[0]?.codingSessions.length,
  1,
  'project mirror snapshots must include authoritative coding session summaries even when the local mirror has no sessions after login.',
);
assert.equal(snapshots[0]?.codingSessions[0]?.id, codingSessionId);
assert.equal(
  snapshots[0]?.codingSessions[0]?.nativeSessionId,
  authoritativeCodingSession.nativeSessionId,
  'project mirror snapshots must preserve authoritative provider-native session ids for terminal resume.',
);
assert.equal(snapshots[0]?.codingSessions[0]?.messageCount, 0);

console.log('project mirror snapshot authoritative sessions contract passed.');
