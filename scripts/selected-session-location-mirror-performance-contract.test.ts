import assert from 'node:assert/strict';
import { refreshCodingSessionMessages } from '../packages/sdkwork-birdcoder-commons/src/workbench/sessionRefresh.ts';
import type {
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionSummary,
  BirdCoderProject,
} from '../packages/sdkwork-birdcoder-types/src/index.ts';

type RefreshCodingSessionMessagesOptions = Parameters<typeof refreshCodingSessionMessages>[0];
type RefreshCoreReadService = NonNullable<RefreshCodingSessionMessagesOptions['coreReadService']>;
type RefreshProjectService = RefreshCodingSessionMessagesOptions['projectService'];

const workspaceId = 'workspace-selected-location-mirror';
const projectId = 'project-selected-location-mirror';
const codingSessionId = 'coding-session-selected-location-mirror';

const summary: BirdCoderCodingSessionSummary = {
  createdAt: '2026-04-29T00:00:00.000Z',
  engineId: 'codex',
  hostMode: 'desktop',
  id: codingSessionId,
  lastTurnAt: '2026-04-29T00:01:00.000Z',
  modelId: 'gpt-5.4',
  nativeSessionId: 'native-selected-location-mirror',
  projectId,
  runtimeStatus: 'completed',
  sortTimestamp: String(Date.parse('2026-04-29T00:01:00.000Z')),
  status: 'active',
  title: 'Selected session mirror location',
  transcriptUpdatedAt: '2026-04-29T00:01:00.000Z',
  updatedAt: '2026-04-29T00:01:00.000Z',
  workspaceId,
};

const mirrorProject: BirdCoderProject = {
  archived: false,
  codingSessions: [],
  createdAt: '2026-04-29T00:00:00.000Z',
  id: projectId,
  name: 'Selected Session Mirror Project',
  path: 'D:/workspace/selected-session-mirror-project',
  updatedAt: '2026-04-29T00:01:00.000Z',
  workspaceId,
};

function unexpectedFullProjectRead(method: string): never {
  throw new Error(`${method} must not be called while a mirror snapshot can locate the selected session.`);
}

let mirrorSnapshotReads = 0;
const projectService: RefreshProjectService = {
  async getProjects() {
    return unexpectedFullProjectRead('getProjects');
  },
  async getProjectById() {
    return unexpectedFullProjectRead('getProjectById');
  },
  async getProjectByPath() {
    return unexpectedFullProjectRead('getProjectByPath');
  },
  async getProjectMirrorSnapshots(requestedWorkspaceId?: string) {
    mirrorSnapshotReads += 1;
    assert.equal(
      requestedWorkspaceId,
      workspaceId,
      'selected-session location reads must stay scoped to the requested workspace.',
    );
    return [
      {
        ...mirrorProject,
        codingSessions: [
          {
            ...summary,
            archived: false,
            displayTime: 'just now',
            messageCount: 3842,
            nativeTranscriptUpdatedAt: summary.transcriptUpdatedAt,
            pinned: false,
            unread: false,
          },
        ],
      },
    ];
  },
  async createProject() {
    return unexpectedFullProjectRead('createProject');
  },
  async renameProject() {},
  async updateProject() {},
  async deleteProject() {},
  async createCodingSession() {
    return unexpectedFullProjectRead('createCodingSession');
  },
  async upsertCodingSession() {},
  async renameCodingSession() {},
  async updateCodingSession() {},
  async forkCodingSession() {
    return unexpectedFullProjectRead('forkCodingSession');
  },
  async deleteCodingSession() {},
  async addCodingSessionMessage() {
    return unexpectedFullProjectRead('addCodingSessionMessage');
  },
  async editCodingSessionMessage() {},
  async deleteCodingSessionMessage() {},
};

const coreReadService: RefreshCoreReadService = {
  async getCodingSession(requestedCodingSessionId: string) {
    assert.equal(requestedCodingSessionId, codingSessionId);
    return summary;
  },
  async listCodingSessionEvents(requestedCodingSessionId: string): Promise<BirdCoderCodingSessionEvent[]> {
    assert.equal(requestedCodingSessionId, codingSessionId);
    return [];
  },
  async listCodingSessions() {
    return [summary];
  },
  async getNativeSession() {
    return unexpectedFullProjectRead('getNativeSession');
  },
  async listNativeSessions() {
    return [];
  },
};

const result = await refreshCodingSessionMessages({
  codingSessionId,
  coreReadService,
  identityScope: 'user-selected-location-mirror',
  projectService,
  workspaceId,
});

assert.equal(result.status, 'refreshed');
assert.equal(result.projectId, projectId);
assert.equal(result.workspaceId, workspaceId);
assert.equal(
  mirrorSnapshotReads,
  1,
  'selected-session message refresh must locate sessions through lightweight mirror snapshots instead of hydrating full project transcripts.',
);

console.log('selected session location mirror performance contract passed.');
