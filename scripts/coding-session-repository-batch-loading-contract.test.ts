import assert from 'node:assert/strict';
import type {
  BirdCoderChatMessage,
} from '@sdkwork/birdcoder-types';
import { ProviderBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts';
import { createBirdCoderRepresentativeAppAdminRepositories } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts';
import {
  createBirdCoderCodingSessionRepositories,
  type BirdCoderPersistedCodingSessionRecord,
  type BirdCoderCodingSessionRepositories,
} from '../packages/sdkwork-birdcoder-infrastructure/src/storage/codingSessionRepository.ts';
import {
  createBirdCoderInMemorySqlExecutor,
} from '../packages/sdkwork-birdcoder-infrastructure/src/storage/sqlExecutor.ts';
import {
  createBirdCoderStorageProvider,
  type BirdCoderSqlPlanStorageAccess,
  type BirdCoderStorageAccess,
} from '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts';

const workspaceId = 'workspace-batch-loading';
const projectId = 'project-batch-loading';
const otherProjectId = 'project-batch-loading-other';

function buildSession(
  id: string,
  project: string,
  updatedAt: string,
): BirdCoderPersistedCodingSessionRecord {
  return {
    id,
    workspaceId,
    projectId: project,
    title: id,
    status: 'active',
    hostMode: 'desktop',
    engineId: 'codex',
    modelId: 'gpt-5.4',
    createdAt: updatedAt,
    updatedAt,
    lastTurnAt: updatedAt,
    transcriptUpdatedAt: null,
    pinned: false,
    archived: false,
    unread: false,
  };
}

function buildMessage(
  codingSessionId: string,
  id: string,
  createdAt: string,
): BirdCoderChatMessage {
  return {
    id,
    codingSessionId,
    role: 'assistant',
    content: id,
    createdAt,
    timestamp: Date.parse(createdAt),
  };
}

const sqlExecutor = createBirdCoderInMemorySqlExecutor('sqlite');
const storageProvider = createBirdCoderStorageProvider('sqlite', {
  sqlExecutor,
});
const appRepositories = createBirdCoderRepresentativeAppAdminRepositories({
  providerId: storageProvider.providerId,
  storage: storageProvider,
});
const codingSessionRepositories = createBirdCoderCodingSessionRepositories({
  providerId: storageProvider.providerId,
  storage: storageProvider,
});

await appRepositories.projects.save({
  id: projectId,
  workspaceId,
  name: 'Batch Loading Project',
  status: 'active',
  createdAt: '2026-04-27T00:00:00.000Z',
  updatedAt: '2026-04-27T00:00:00.000Z',
});
await appRepositories.projects.save({
  id: otherProjectId,
  workspaceId,
  name: 'Other Batch Loading Project',
  status: 'active',
  createdAt: '2026-04-27T00:00:00.000Z',
  updatedAt: '2026-04-27T00:00:00.000Z',
});

await codingSessionRepositories.sessions.saveMany([
  buildSession('session-a', projectId, '2026-04-27T00:01:00.000Z'),
  buildSession('session-b', projectId, '2026-04-27T00:02:00.000Z'),
  buildSession('session-other', otherProjectId, '2026-04-27T00:03:00.000Z'),
]);
await codingSessionRepositories.messages.saveMany([
  buildMessage('session-a', 'session-a:message:1', '2026-04-27T00:01:01.000Z'),
  buildMessage('session-a', 'session-a:native-message:2', '2026-04-27T00:01:02.000Z'),
  buildMessage('session-b', 'session-b:message:1', '2026-04-27T00:02:01.000Z'),
  buildMessage('session-other', 'session-other:message:1', '2026-04-27T00:03:01.000Z'),
]);

sqlExecutor.history.length = 0;

assert.equal(
  typeof codingSessionRepositories.listSessionsByProjectIds,
  'function',
  'coding session repositories must expose a project-id batched session reader.',
);
assert.equal(
  typeof codingSessionRepositories.listMessagesByCodingSessionIds,
  'function',
  'coding session repositories must expose a session-id batched transcript reader.',
);
assert.equal(
  typeof codingSessionRepositories.readMessageMetadataByCodingSessionIds,
  'function',
  'coding session repositories must expose a session-id batched transcript metadata reader.',
);

const projectSessions = await codingSessionRepositories.listSessionsByProjectIds([
  projectId,
]);
assert.deepEqual(
  projectSessions.map((session) => session.id),
  ['session-b', 'session-a'],
  'batched session reads must only return sessions from requested projects in activity order.',
);

const sessionMessages = await codingSessionRepositories.listMessagesByCodingSessionIds([
  'session-a',
]);
assert.deepEqual(
  sessionMessages.map((message) => message.id),
  ['session-a:message:1', 'session-a:native-message:2'],
  'batched transcript reads must only hydrate messages for requested sessions.',
);

const messageMetadata =
  await codingSessionRepositories.readMessageMetadataByCodingSessionIds([
    'session-a',
    'session-b',
  ]);
assert.deepEqual(
  messageMetadata.get('session-a'),
  {
    codingSessionId: 'session-a',
    latestTranscriptUpdatedAt: '2026-04-27T00:01:02.000Z',
    messageCount: 2,
    nativeTranscriptUpdatedAt: '2026-04-27T00:01:02.000Z',
  },
  'batched message metadata must include count, latest transcript timestamp, and native transcript timestamp.',
);
assert.deepEqual(
  messageMetadata.get('session-b'),
  {
    codingSessionId: 'session-b',
    latestTranscriptUpdatedAt: '2026-04-27T00:02:01.000Z',
    messageCount: 1,
    nativeTranscriptUpdatedAt: null,
  },
);

assert.deepEqual(
  sqlExecutor.history.map((plan) => plan.meta?.kind),
  [
    'coding-session-list-by-project-ids',
    'coding-session-messages-by-session-ids',
    'coding-session-message-metadata-by-session-ids',
  ],
  'batch loading must use targeted SQL plans instead of generic full table scans.',
);

let degradedSqlExecutionAttempts = 0;
const degradedCodingSessionStorage: BirdCoderStorageAccess & BirdCoderSqlPlanStorageAccess = {
  sqlPlanExecutionEnabled: true,
  async executeSqlPlan() {
    degradedSqlExecutionAttempts += 1;
    throw new Error('Tauri SQL bridge is temporarily unavailable during startup.');
  },
  async readRawValue() {
    throw new Error('degraded coding session repositories must not read table snapshots through raw local storage.');
  },
  async removeRawValue() {
    throw new Error('degraded coding session repositories must not remove table snapshots through raw local storage.');
  },
  async setRawValue() {
    throw new Error('degraded coding session repositories must not write table snapshots through raw local storage.');
  },
};
const degradedCodingSessionRepositories = createBirdCoderCodingSessionRepositories({
  providerId: 'sqlite',
  storage: degradedCodingSessionStorage,
});
await degradedCodingSessionRepositories.sessions.saveMany([
  buildSession('degraded-session-a', projectId, '2026-04-27T00:04:00.000Z'),
  buildSession('degraded-session-b', otherProjectId, '2026-04-27T00:05:00.000Z'),
]);
await degradedCodingSessionRepositories.messages.saveMany([
  buildMessage('degraded-session-a', 'degraded-session-a:message:1', '2026-04-27T00:04:01.000Z'),
  buildMessage('degraded-session-a', 'degraded-session-a:native-message:2', '2026-04-27T00:04:02.000Z'),
  buildMessage('degraded-session-b', 'degraded-session-b:message:1', '2026-04-27T00:05:01.000Z'),
]);
const degradedProjectSessions =
  await degradedCodingSessionRepositories.listSessionsByProjectIds([projectId]);
assert.deepEqual(
  degradedProjectSessions.map((session) => session.id),
  ['degraded-session-a'],
  'batched session reads must fall back to the repository view when the SQL accelerator rejects during startup.',
);
const degradedSessionMessages =
  await degradedCodingSessionRepositories.listMessagesByCodingSessionIds([
    'degraded-session-a',
  ]);
assert.deepEqual(
  degradedSessionMessages.map((message) => message.id),
  ['degraded-session-a:message:1', 'degraded-session-a:native-message:2'],
  'batched transcript reads must fall back to the repository view when the SQL accelerator rejects during startup.',
);
const degradedMessageMetadata =
  await degradedCodingSessionRepositories.readMessageMetadataByCodingSessionIds([
    'degraded-session-a',
  ]);
assert.deepEqual(
  degradedMessageMetadata.get('degraded-session-a'),
  {
    codingSessionId: 'degraded-session-a',
    latestTranscriptUpdatedAt: '2026-04-27T00:04:02.000Z',
    messageCount: 2,
    nativeTranscriptUpdatedAt: '2026-04-27T00:04:02.000Z',
  },
  'batched transcript metadata must fall back to the repository view when the SQL accelerator rejects during startup.',
);
assert.ok(
  degradedSqlExecutionAttempts >= 1,
  'degraded batch loading must prove the SQL accelerator failure path was exercised.',
);

const guardedCodingSessionRepositories: BirdCoderCodingSessionRepositories = {
  ...codingSessionRepositories,
  messages: {
    ...codingSessionRepositories.messages,
    async list() {
      throw new Error('getProjectMirrorSnapshots must not full-scan transcript messages.');
    },
  },
};
const service = new ProviderBackedProjectService({
  codingSessionRepositories: guardedCodingSessionRepositories,
  projectContentRepository: appRepositories.projectContents,
  repository: appRepositories.projects,
});
sqlExecutor.history.length = 0;

const snapshots = await service.getProjectMirrorSnapshots(workspaceId);
const batchLoadingSnapshot = snapshots.find((project) => project.id === projectId);
assert.ok(batchLoadingSnapshot);
assert.deepEqual(
  batchLoadingSnapshot.codingSessions.map((session) => ({
    id: session.id,
    messageCount: session.messageCount,
    nativeTranscriptUpdatedAt: session.nativeTranscriptUpdatedAt,
    transcriptUpdatedAt: session.transcriptUpdatedAt,
  })),
  [
    {
      id: 'session-b',
      messageCount: 1,
      nativeTranscriptUpdatedAt: null,
      transcriptUpdatedAt: '2026-04-27T00:02:01.000Z',
    },
    {
      id: 'session-a',
      messageCount: 2,
      nativeTranscriptUpdatedAt: '2026-04-27T00:01:02.000Z',
      transcriptUpdatedAt: '2026-04-27T00:01:02.000Z',
    },
  ],
  'provider mirror snapshots must summarize sessions from batch metadata without hydrating transcripts.',
);
assert.equal(
  sqlExecutor.history.some(
    (plan) =>
      plan.meta?.kind === 'table-list' &&
      plan.meta.tableName === 'coding_session_messages',
  ),
  false,
  'provider mirror snapshots must not issue a full coding_session_messages table-list plan.',
);

console.log('coding session repository batch loading contract passed.');
