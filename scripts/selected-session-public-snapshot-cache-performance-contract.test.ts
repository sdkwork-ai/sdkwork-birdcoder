import assert from 'node:assert/strict';
import { ProviderBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts';
import { createBirdCoderRepresentativeAppAdminRepositories } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts';
import {
  createBirdCoderCodingSessionRepositories,
  type BirdCoderPersistedCodingSessionRecord,
} from '../packages/sdkwork-birdcoder-infrastructure/src/storage/codingSessionRepository.ts';
import { createBirdCoderStorageProvider } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts';
import { createBirdCoderInMemorySqlExecutor } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/sqlExecutor.ts';
import type { BirdCoderChatMessage } from '../packages/sdkwork-birdcoder-types/src/index.ts';

const workspaceId = 'workspace-selected-public-snapshot-cache';
const projectId = 'project-selected-public-snapshot-cache';
const codingSessionId = 'session-selected-public-snapshot-cache';
const timestamp = '2026-04-29T00:01:00.000Z';

function buildSession(): BirdCoderPersistedCodingSessionRecord {
  return {
    archived: false,
    createdAt: timestamp,
    engineId: 'codex',
    hostMode: 'desktop',
    id: codingSessionId,
    lastTurnAt: timestamp,
    modelId: 'gpt-5.4',
    pinned: false,
    projectId,
    status: 'active',
    title: 'Public Snapshot Cache',
    transcriptUpdatedAt: timestamp,
    unread: false,
    updatedAt: timestamp,
    workspaceId,
  };
}

function buildMessage(id: string, createdAt: string): BirdCoderChatMessage {
  return {
    codingSessionId,
    content: id,
    createdAt,
    id,
    metadata: {
      nested: {
        value: id,
      },
    },
    role: 'assistant',
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
  createdAt: timestamp,
  id: projectId,
  name: 'Public Snapshot Cache',
  status: 'active',
  updatedAt: timestamp,
  workspaceId,
});
await codingSessionRepositories.sessions.save(buildSession());
await codingSessionRepositories.messages.saveMany([
  buildMessage('selected-public-snapshot-message-1', '2026-04-29T00:01:01.000Z'),
  buildMessage('selected-public-snapshot-message-2', '2026-04-29T00:01:02.000Z'),
]);

const service = new ProviderBackedProjectService({
  codingSessionRepositories,
  projectContentRepository: appRepositories.projectContents,
  repository: appRepositories.projects,
});

sqlExecutor.history.length = 0;
const firstTranscript = await service.getCodingSessionTranscript(projectId, codingSessionId);
assert.ok(firstTranscript, 'first selected-session transcript read must hydrate from local storage.');
assert.deepEqual(
  firstTranscript.messages.map((message) => message.id),
  ['selected-public-snapshot-message-1', 'selected-public-snapshot-message-2'],
);
assert.deepEqual(
  sqlExecutor.history.map((plan) => plan.meta?.kind),
  ['table-find-by-id', 'coding-session-messages-by-session-ids'],
  'first selected-session transcript read should load the session row and the clicked transcript once.',
);

assert.equal(
  Object.isFrozen(firstTranscript),
  true,
  'public selected-session transcript snapshots must be frozen.',
);
assert.equal(
  Object.isFrozen(firstTranscript.messages),
  true,
  'public selected-session transcript message arrays must be frozen.',
);
assert.equal(
  Object.isFrozen(firstTranscript.messages[0]),
  true,
  'public selected-session transcript messages must be frozen.',
);
assert.equal(
  Object.isFrozen(firstTranscript.messages[0]?.metadata),
  true,
  'public selected-session transcript message metadata must be frozen.',
);

assert.throws(
  () => {
    (firstTranscript as { title: string }).title = 'mutated title';
  },
  TypeError,
  'callers must not be able to mutate a public transcript snapshot title.',
);
assert.throws(
  () => {
    firstTranscript.messages.push(
      buildMessage('mutated-message', '2026-04-29T00:01:03.000Z'),
    );
  },
  TypeError,
  'callers must not be able to mutate a public transcript snapshot message array.',
);
assert.throws(
  () => {
    (firstTranscript.messages[0] as BirdCoderChatMessage).content = 'mutated content';
  },
  TypeError,
  'callers must not be able to mutate a public transcript snapshot message.',
);

sqlExecutor.history.length = 0;
const cachedTranscript = await service.getCodingSessionTranscript(projectId, codingSessionId);
assert.equal(
  cachedTranscript,
  firstTranscript,
  'repeated selected-session transcript reads must return the cached public snapshot instead of deep-cloning the transcript.',
);
assert.deepEqual(
  sqlExecutor.history,
  [],
  'repeated selected-session transcript reads must not call local_sql_execute_plan.',
);

await service.renameCodingSession(projectId, codingSessionId, 'Renamed Public Snapshot Cache');
const renamedTranscript = await service.getCodingSessionTranscript(projectId, codingSessionId);
assert.notEqual(
  renamedTranscript,
  firstTranscript,
  'transcript metadata mutations must publish a new public snapshot version.',
);
assert.equal(
  renamedTranscript?.title,
  'Renamed Public Snapshot Cache',
  'new public snapshot versions must reflect latest session metadata.',
);
assert.deepEqual(
  renamedTranscript?.messages.map((message) => message.content),
  ['selected-public-snapshot-message-1', 'selected-public-snapshot-message-2'],
  'metadata-only mutations must keep the hydrated transcript messages.',
);

console.log('selected session public snapshot cache performance contract passed.');
