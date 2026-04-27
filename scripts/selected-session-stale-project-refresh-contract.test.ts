import assert from 'node:assert/strict';
import {
  mergeProjectsForStore,
  upsertCodingSessionIntoCollection,
} from '../packages/sdkwork-birdcoder-commons/src/stores/projectsStore.ts';
import { refreshCodingSessionMessages } from '../packages/sdkwork-birdcoder-commons/src/workbench/sessionRefresh.ts';
import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderCodingSessionSummary,
  BirdCoderProject,
} from '../packages/sdkwork-birdcoder-types/src/index.ts';

const projectId = 'project-stale-local-mirror';
const workspaceId = 'workspace-local';
const codingSessionId = 'coding-session-authoritative';
const sortTimestamp = String(Date.parse('2026-04-24T00:00:00.000Z'));
type RefreshCodingSessionMessagesOptions = Parameters<typeof refreshCodingSessionMessages>[0];
type RefreshCoreReadService = NonNullable<RefreshCodingSessionMessagesOptions['coreReadService']>;
type RefreshProjectService = RefreshCodingSessionMessagesOptions['projectService'];

function unexpectedProjectServiceCall(method: string): never {
  throw new Error(`${method} should not be called by this contract`);
}

const existingSession: BirdCoderCodingSession = {
  archived: false,
  createdAt: '2026-04-24T00:00:00.000Z',
  displayTime: 'just now',
  engineId: 'codex',
  hostMode: 'desktop',
  id: codingSessionId,
  lastTurnAt: '2026-04-24T00:00:00.000Z',
  messages: [],
  modelId: 'gpt-5.4',
  pinned: false,
  projectId,
  runtimeStatus: 'streaming',
  sortTimestamp,
  status: 'active',
  title: 'Authoritative session',
  transcriptUpdatedAt: '2026-04-24T00:00:00.000Z',
  unread: false,
  updatedAt: '2026-04-24T00:00:00.000Z',
  workspaceId,
};

const project: BirdCoderProject = {
  archived: false,
  codingSessions: [existingSession],
  createdAt: '2026-04-24T00:00:00.000Z',
  id: projectId,
  name: 'Stale local mirror project',
  path: 'D:/workspace/stale-local-mirror-project',
  updatedAt: '2026-04-24T00:00:00.000Z',
  workspaceId,
};

const summary: BirdCoderCodingSessionSummary = {
  createdAt: existingSession.createdAt,
  engineId: existingSession.engineId,
  hostMode: existingSession.hostMode,
  id: codingSessionId,
  lastTurnAt: '2026-04-24T00:01:00.000Z',
  modelId: existingSession.modelId,
  projectId,
  runtimeStatus: 'completed',
  status: 'active',
  title: existingSession.title,
  transcriptUpdatedAt: '2026-04-24T00:01:00.000Z',
  updatedAt: '2026-04-24T00:01:00.000Z',
  workspaceId,
};

let upsertAttempts = 0;
let invalidateScope:
  | Parameters<NonNullable<RefreshProjectService['invalidateProjectReadCache']>>[0]
  | null = null;
let projectRehydrationAttempts = 0;
const projectService: RefreshProjectService = {
  async getProjects() {
    return [project];
  },
  async getProjectById(candidateProjectId: string) {
    projectRehydrationAttempts += 1;
    return candidateProjectId === projectId ? project : null;
  },
  invalidateProjectReadCache(scope) {
    invalidateScope = scope ?? null;
  },
  async getProjectByPath() {
    return unexpectedProjectServiceCall('getProjectByPath');
  },
  async createProject() {
    return unexpectedProjectServiceCall('createProject');
  },
  async renameProject() {
    return unexpectedProjectServiceCall('renameProject');
  },
  async updateProject() {
    return unexpectedProjectServiceCall('updateProject');
  },
  async deleteProject() {
    return unexpectedProjectServiceCall('deleteProject');
  },
  async createCodingSession() {
    return unexpectedProjectServiceCall('createCodingSession');
  },
  async upsertCodingSession(candidateProjectId: string) {
    upsertAttempts += 1;
    if (upsertAttempts === 1) {
      throw new Error(`Project ${candidateProjectId} not found`);
    }
  },
  async renameCodingSession() {
    return unexpectedProjectServiceCall('renameCodingSession');
  },
  async updateCodingSession() {
    return unexpectedProjectServiceCall('updateCodingSession');
  },
  async forkCodingSession() {
    return unexpectedProjectServiceCall('forkCodingSession');
  },
  async deleteCodingSession() {
    return unexpectedProjectServiceCall('deleteCodingSession');
  },
  async addCodingSessionMessage() {
    return unexpectedProjectServiceCall('addCodingSessionMessage');
  },
  async editCodingSessionMessage() {
    return unexpectedProjectServiceCall('editCodingSessionMessage');
  },
  async deleteCodingSessionMessage() {
    return unexpectedProjectServiceCall('deleteCodingSessionMessage');
  },
};

const coreReadService: RefreshCoreReadService = {
  async getCodingSession() {
    return summary;
  },
  async getNativeSession() {
    throw new Error('native session detail should not be requested');
  },
  async listCodingSessionEvents() {
    return [];
  },
  async listCodingSessions() {
    return [summary];
  },
  async listNativeSessions() {
    return [];
  },
};

const result = await refreshCodingSessionMessages({
  codingSessionId,
  coreReadService,
  projectService,
  resolvedLocation: {
    codingSession: existingSession,
    project,
    summary,
  },
  workspaceId,
});

assert.equal(upsertAttempts, 2);
assert.deepEqual(invalidateScope, { projectId, workspaceId });
assert.equal(projectRehydrationAttempts, 1);
assert.equal(result.status, 'refreshed');
assert.equal(result.projectId, projectId);
assert.equal(result.codingSession?.id, codingSessionId);

const staleLocationProjectId = 'project-stale-location-cache';
const staleLocationWorkspaceId = 'workspace-stale-location';
const staleLocationCodingSessionId = 'coding-session-stale-location';
const staleLocationSession: BirdCoderCodingSession = {
  ...existingSession,
  id: staleLocationCodingSessionId,
  projectId: staleLocationProjectId,
  workspaceId: staleLocationWorkspaceId,
};
const staleLocationProject: BirdCoderProject = {
  ...project,
  codingSessions: [staleLocationSession],
  id: staleLocationProjectId,
  workspaceId: staleLocationWorkspaceId,
};
const staleLocationSummary: BirdCoderCodingSessionSummary = {
  ...summary,
  id: staleLocationCodingSessionId,
  projectId: staleLocationProjectId,
  workspaceId: staleLocationWorkspaceId,
};

let staleLocationProjectReads = 0;
let staleLocationInvalidationScope:
  | Parameters<NonNullable<RefreshProjectService['invalidateProjectReadCache']>>[0]
  | null = null;
let staleLocationUpserts = 0;

const staleLocationProjectService: RefreshProjectService = {
  ...projectService,
  async getProjects() {
    return [];
  },
  async getProjectById(candidateProjectId: string) {
    staleLocationProjectReads += 1;
    if (candidateProjectId !== staleLocationProjectId) {
      return null;
    }

    return staleLocationProjectReads === 1 ? null : staleLocationProject;
  },
  invalidateProjectReadCache(scope) {
    staleLocationInvalidationScope = scope ?? null;
  },
  async upsertCodingSession(candidateProjectId: string) {
    assert.equal(candidateProjectId, staleLocationProjectId);
    staleLocationUpserts += 1;
  },
};

const staleLocationCoreReadService: RefreshCoreReadService = {
  ...coreReadService,
  async getCodingSession() {
    return staleLocationSummary;
  },
  async listCodingSessions() {
    return [staleLocationSummary];
  },
};

const staleLocationResult = await refreshCodingSessionMessages({
  codingSessionId: staleLocationCodingSessionId,
  coreReadService: staleLocationCoreReadService,
  projectService: staleLocationProjectService,
  workspaceId: staleLocationWorkspaceId,
});

assert.equal(staleLocationResult.status, 'refreshed');
assert.equal(staleLocationProjectReads, 2);
assert.deepEqual(
  staleLocationInvalidationScope,
  {
    projectId: staleLocationProjectId,
    workspaceId: staleLocationWorkspaceId,
  },
);
assert.equal(staleLocationUpserts, 1);

const staleStoreMessage: BirdCoderChatMessage = {
  codingSessionId,
  content: 'This message was deleted upstream.',
  createdAt: '2026-04-24T00:02:00.000Z',
  id: 'deleted-upstream-message',
  role: 'assistant',
  timestamp: Date.parse('2026-04-24T00:02:00.000Z'),
  turnId: 'deleted-upstream-turn',
};
const projectWithLoadedTranscript: BirdCoderProject = {
  ...project,
  codingSessions: [
    {
      ...existingSession,
      messages: [staleStoreMessage],
    },
  ],
};
const emptyTranscriptSession: BirdCoderCodingSession = {
  ...existingSession,
  messages: [],
  transcriptUpdatedAt: '2026-04-24T00:03:00.000Z',
  updatedAt: '2026-04-24T00:03:00.000Z',
};

const inventoryMergedProjects = mergeProjectsForStore(
  [projectWithLoadedTranscript],
  [
    {
      ...projectWithLoadedTranscript,
      codingSessions: [emptyTranscriptSession],
    },
  ],
);
assert.equal(
  inventoryMergedProjects[0]?.codingSessions[0]?.messages.length,
  1,
  'project inventory snapshots with omitted transcripts must preserve the already-loaded selected-session messages.',
);

const pollutedInventoryMergedProjects = mergeProjectsForStore(
  [
    {
      ...projectWithLoadedTranscript,
      codingSessions: [
        {
          ...existingSession,
          messages: [
            {
              ...staleStoreMessage,
              codingSessionId: 'another-coding-session',
            },
          ],
        },
      ],
    },
  ],
  [
    {
      ...projectWithLoadedTranscript,
      codingSessions: [emptyTranscriptSession],
    },
  ],
);
assert.equal(
  pollutedInventoryMergedProjects[0]?.codingSessions[0]?.messages.length,
  0,
  'project inventory snapshots must not keep preserved transcript messages that belong to another session.',
);

const mixedIncomingTranscriptProjects = mergeProjectsForStore(
  [project],
  [
    {
      ...project,
      codingSessions: [
        {
          ...existingSession,
          messages: [
            staleStoreMessage,
            {
              ...staleStoreMessage,
              codingSessionId: 'another-coding-session',
              id: 'wrong-session-incoming-message',
            },
          ],
        },
      ],
    },
  ],
);
assert.deepEqual(
  mixedIncomingTranscriptProjects[0]?.codingSessions[0]?.messages.map(
    (message) => message.id,
  ),
  [staleStoreMessage.id],
  'project store merges must drop non-empty incoming transcript messages that belong to another session.',
);

const selectedSessionUpsertProjects = upsertCodingSessionIntoCollection(
  [projectWithLoadedTranscript],
  projectId,
  emptyTranscriptSession,
);
assert.equal(
  selectedSessionUpsertProjects[0]?.codingSessions[0]?.messages.length,
  0,
  'explicit selected-session upserts with an empty transcript must clear stale messages instead of treating the payload as inventory.',
);

const pollutedLocalMessage: BirdCoderChatMessage = {
  ...staleStoreMessage,
  codingSessionId: 'another-coding-session',
  content: 'This belongs to another session.',
  id: 'polluted-local-message',
};
const pollutedLocalSession: BirdCoderCodingSession = {
  ...existingSession,
  messages: [pollutedLocalMessage],
  runtimeStatus: 'completed',
};
const pollutedLocalSummary: BirdCoderCodingSessionSummary = {
  ...summary,
  lastTurnAt: pollutedLocalSession.lastTurnAt,
  runtimeStatus: 'completed',
  transcriptUpdatedAt: pollutedLocalSession.transcriptUpdatedAt,
  updatedAt: pollutedLocalSession.updatedAt,
};
let pollutedLocalEventReads = 0;
let pollutedLocalUpserts = 0;
const pollutedLocalResult = await refreshCodingSessionMessages({
  codingSessionId,
  coreReadService: {
    ...coreReadService,
    async getCodingSession() {
      return pollutedLocalSummary;
    },
    async listCodingSessionEvents() {
      pollutedLocalEventReads += 1;
      return [];
    },
  },
  projectService: {
    ...projectService,
    async upsertCodingSession(candidateProjectId: string, candidateCodingSession: BirdCoderCodingSession) {
      assert.equal(candidateProjectId, projectId);
      assert.equal(candidateCodingSession.messages.length, 0);
      pollutedLocalUpserts += 1;
    },
  },
  resolvedLocation: {
    codingSession: pollutedLocalSession,
    project: {
      ...project,
      codingSessions: [pollutedLocalSession],
    },
    summary: pollutedLocalSummary,
  },
  workspaceId,
});
assert.equal(pollutedLocalResult.status, 'refreshed');
assert.equal(pollutedLocalEventReads, 1);
assert.equal(pollutedLocalUpserts, 1);
assert.deepEqual(
  pollutedLocalResult.codingSession?.messages,
  [],
  'selected-session refresh must not reuse a local transcript that contains messages from another session.',
);

const externallyUpdatedLocalMessage: BirdCoderChatMessage = {
  codingSessionId,
  content: 'Summarize the module.',
  createdAt: '2026-04-24T00:04:00.000Z',
  id: 'local-existing-user-message',
  role: 'user',
  timestamp: Date.parse('2026-04-24T00:04:00.000Z'),
  turnId: 'external-existing-turn',
};
const externallyUpdatedSession: BirdCoderCodingSession = {
  ...existingSession,
  lastTurnAt: '2026-04-24T00:04:00.000Z',
  messages: [externallyUpdatedLocalMessage],
  runtimeStatus: 'completed',
  transcriptUpdatedAt: '2026-04-24T00:04:00.000Z',
  updatedAt: '2026-04-24T00:04:00.000Z',
};
const externallyUpdatedSummary: BirdCoderCodingSessionSummary = {
  ...summary,
  lastTurnAt: externallyUpdatedSession.lastTurnAt,
  runtimeStatus: 'completed',
  transcriptUpdatedAt: externallyUpdatedSession.transcriptUpdatedAt,
  updatedAt: externallyUpdatedSession.updatedAt,
};
let externalEventReads = 0;
let externalUpserts = 0;
const externalSyncResult = await refreshCodingSessionMessages({
  codingSessionId,
  coreReadService: {
    ...coreReadService,
    async getCodingSession() {
      return externallyUpdatedSummary;
    },
    async listCodingSessionEvents() {
      externalEventReads += 1;
      return [
        {
          codingSessionId,
          createdAt: '2026-04-24T00:04:00.000Z',
          id: 'external-existing-user-event',
          kind: 'message.completed',
          payload: {
            content: 'Summarize the module.',
            role: 'user',
          },
          sequence: '1',
          turnId: 'external-existing-turn',
        },
        {
          codingSessionId,
          createdAt: '2026-04-24T00:05:00.000Z',
          id: 'external-cli-assistant-event',
          kind: 'message.completed',
          payload: {
            content: 'The module owns session synchronization.',
            role: 'assistant',
          },
          sequence: '2',
          turnId: 'external-cli-turn',
        },
      ];
    },
  },
  projectService: {
    ...projectService,
    async upsertCodingSession(candidateProjectId: string, candidateCodingSession: BirdCoderCodingSession) {
      assert.equal(candidateProjectId, projectId);
      assert.deepEqual(
        candidateCodingSession.messages.map((message) => message.content),
        [
          'Summarize the module.',
          'The module owns session synchronization.',
        ],
      );
      externalUpserts += 1;
    },
  },
  resolvedLocation: {
    codingSession: externallyUpdatedSession,
    project: {
      ...project,
      codingSessions: [externallyUpdatedSession],
    },
    summary: externallyUpdatedSummary,
  },
  workspaceId,
});
assert.equal(externalSyncResult.status, 'refreshed');
assert.equal(
  externalEventReads,
  1,
  'selected-session refresh must read authoritative events even when summary timestamps match the local mirror, because external CLI/IDE turns can arrive without a reliable local transcript version.',
);
assert.equal(externalUpserts, 1);
assert.deepEqual(
  externalSyncResult.codingSession?.messages.map((message) => message.content),
  [
    'Summarize the module.',
    'The module owns session synchronization.',
  ],
  'selected-session refresh must merge messages that were added to the same session by another CLI or IDE.',
);

console.log('selected session stale project refresh contract passed.');
