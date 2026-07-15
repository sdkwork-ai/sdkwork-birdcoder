import type {
  BirdCoderAppRuntimeReadSdkApiClient,
  BirdCoderAppSdkApiClient,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';
import type {
  BirdCoderCodingSession,
  BirdCoderCodingSessionSummary,
  BirdCoderProject,
  BirdCoderProjectSummary,
} from '@sdkwork/birdcoder-pc-types';
import { ApiBackedProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type { IProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IProjectService.ts';

const workspaceId = 'workspace-authority-mirror-sync';
const projectId = 'project-authority-mirror-sync';
const codingSessionId = 'coding-session-authority-mirror-sync';

const projectSummary: BirdCoderProjectSummary = {
  id: projectId,
  workspaceId,
  name: 'Authority Mirrored Project',
  description: 'Imported project mirrors must be synchronized with authority during inventory reads.',
  status: 'active',
  createdAt: '2026-04-25T00:00:00.000Z',
  updatedAt: '2026-04-25T00:01:00.000Z',
};

const localProject: BirdCoderProject = {
  id: projectId,
  workspaceId,
  name: 'Stale Imported Project Name',
  description: 'Local imported project mirror before authority synchronization.',
  createdAt: '2026-04-25T00:00:00.000Z',
  updatedAt: '2026-04-25T00:00:00.000Z',
  codingSessions: [],
};

const authoritativeCodingSession: BirdCoderCodingSessionSummary = {
  id: codingSessionId,
  workspaceId,
  projectId,
  title: 'Authority mirrored session',
  status: 'active',
  hostMode: 'desktop',
  engineId: 'codex',
  modelId: 'gpt-5.4',
  nativeSessionId: 'authority-mirror-native-session',
  runtimeStatus: 'completed',
  createdAt: '2026-04-25T00:02:00.000Z',
  updatedAt: '2026-04-25T00:03:00.000Z',
  lastTurnAt: '2026-04-25T00:03:00.000Z',
  sortTimestamp: String(Date.parse('2026-04-25T00:03:00.000Z')),
  transcriptUpdatedAt: '2026-04-25T00:03:00.000Z',
};

let syncedProjectSummary: BirdCoderProjectSummary | null = null;
const mirroredProjectIds = new Set<string>();
let mirroredCodingSessionId: string | null = null;

const client = {
  async getProject(
    requestedProjectId: string,
  ): Promise<Awaited<ReturnType<BirdCoderAppSdkApiClient['getProject']>>> {
    assert.equal(requestedProjectId, projectId);
    return projectSummary;
  },
  async listProjects(
    options?: Parameters<BirdCoderAppSdkApiClient['listProjects']>[0],
  ): Promise<Awaited<ReturnType<BirdCoderAppSdkApiClient['listProjects']>>> {
    assert.equal(options?.workspaceId, workspaceId);
    return [projectSummary];
  },
} as unknown as BirdCoderAppSdkApiClient;

const appRuntimeReadClient = {
  async listCodingSessions(
    request?: Parameters<BirdCoderAppRuntimeReadSdkApiClient['listCodingSessions']>[0],
  ): Promise<BirdCoderCodingSessionSummary[]> {
    return request?.workspaceId === workspaceId ? [authoritativeCodingSession] : [];
  },
} as unknown as BirdCoderAppRuntimeReadSdkApiClient;

const projectMirror = {
  async syncProjectSummary(summary: BirdCoderProjectSummary): Promise<BirdCoderProject> {
    syncedProjectSummary = summary;
    mirroredProjectIds.add(summary.id);
    return {
      archived: summary.status === 'archived',
      codingSessions: [],
      createdAt: summary.createdAt,
      description: summary.description,
      id: summary.id,
      name: summary.name,
      updatedAt: summary.updatedAt,
      workspaceId: summary.workspaceId,
    };
  },
};

const codingSessionMirror = {
  async upsertCodingSession(candidateProjectId: string, codingSession: BirdCoderCodingSession) {
    assert.equal(
      mirroredProjectIds.has(candidateProjectId),
      true,
      'session upsert must first ensure the authoritative project exists in the local project mirror.',
    );
    mirroredCodingSessionId = codingSession.id;
    assert.equal(
      codingSession.nativeSessionId,
      authoritativeCodingSession.nativeSessionId,
      'session mirror writes must preserve authoritative provider-native session ids.',
    );
  },
};

const writeService = {
  async getProjectById() {
    return null;
  },
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
  codingSessionMirror,
  appClient: client,
  codingRuntimeClient: appRuntimeReadClient,
  projectMirror,
  writeService,
});

const snapshots = await service.getProjectMirrorSnapshots(workspaceId);

assert.equal(
  syncedProjectSummary?.id,
  projectId,
  'project mirror snapshot reads must synchronize imported project summaries before exposing their sessions to UI selection.',
);
assert.equal(snapshots.length, 1);
assert.equal(snapshots[0]?.id, projectId);
assert.equal(
  Object.hasOwn(syncedProjectSummary ?? {}, 'rootPath'),
  false,
  'authority summaries synchronized into the local mirror must not carry a client filesystem root.',
);
assert.equal(
  Object.hasOwn(snapshots[0] ?? {}, 'path'),
  false,
  'mirror snapshots must remain path-free; device mounts are resolved separately by project id.',
);
assert.equal(snapshots[0]?.codingSessions.length, 1);
assert.equal(snapshots[0]?.codingSessions[0]?.id, codingSessionId);
assert.equal(
  snapshots[0]?.codingSessions[0]?.nativeSessionId,
  authoritativeCodingSession.nativeSessionId,
);

mirroredProjectIds.clear();
syncedProjectSummary = null;

await service.upsertCodingSession(projectId, {
  ...authoritativeCodingSession,
  displayTime: 'Just now',
  messages: [],
});

assert.equal(
  syncedProjectSummary?.id,
  projectId,
  'session mirror upserts must synchronize the authoritative project before writing the session mirror.',
);
assert.equal(mirroredCodingSessionId, codingSessionId);

console.log('project mirror snapshot syncs authority project contract passed.');
