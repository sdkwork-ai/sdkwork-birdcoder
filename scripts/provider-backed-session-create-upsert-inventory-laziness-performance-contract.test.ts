import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ProviderBackedProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ProviderBackedProjectService.ts';
import { createBirdCoderConsoleRepositories } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/appConsoleRepository.ts';
import {
  createBirdCoderCodingSessionRepositories,
  type BirdCoderPersistedCodingSessionRecord,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/codingSessionRepository.ts';
import { createBirdCoderStorageProvider } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/dataKernel.ts';
import { createBirdCoderInMemorySqlExecutor } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/sqlExecutor.ts';
import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/index.ts';

const workspaceId = 'workspace-session-create-upsert-inventory-laziness';
const projectId = 'project-session-create-upsert-inventory-laziness';
const sessionId = 'session-create-upsert-inventory-laziness';
const timestamp = '2026-04-30T10:00:00.000Z';

function buildSession(id: string): BirdCoderPersistedCodingSessionRecord {
  return {
    archived: false,
    createdAt: timestamp,
    engineId: 'codex',
    hostMode: 'desktop',
    id,
    modelId: 'gpt-5.4',
    pinned: false,
    projectId,
    status: 'active',
    title: id,
    transcriptUpdatedAt: timestamp,
    unread: false,
    updatedAt: timestamp,
    workspaceId,
  };
}

function buildMessage(sessionId: string, id: string): BirdCoderChatMessage {
  return {
    codingSessionId: sessionId,
    content: id,
    createdAt: timestamp,
    id,
    role: 'assistant',
    timestamp: Date.parse(timestamp),
  };
}

function buildCodingSessionSummaryInput(
  session: BirdCoderPersistedCodingSessionRecord,
  title: string,
): BirdCoderCodingSession {
  return {
    id: session.id,
    workspaceId: session.workspaceId,
    projectId: session.projectId,
    title,
    status: session.status,
    hostMode: session.hostMode,
    engineId: session.engineId,
    modelId: session.modelId,
    nativeSessionId: session.nativeSessionId,
    createdAt: session.createdAt,
    updatedAt: '2026-04-30T10:01:00.000Z',
    lastTurnAt: session.lastTurnAt,
    sortTimestamp: session.sortTimestamp,
    transcriptUpdatedAt: session.transcriptUpdatedAt,
    displayTime: timestamp,
    pinned: session.pinned,
    archived: session.archived,
    unread: session.unread,
    messages: [],
  };
}

function countPlanKind(kind: string): number {
  return sqlExecutor.history.filter((plan) => plan.meta?.kind === kind).length;
}

const sqlExecutor = createBirdCoderInMemorySqlExecutor('sqlite');
const storageProvider = createBirdCoderStorageProvider('sqlite', {
  sqlExecutor,
});
const appRepositories = createBirdCoderConsoleRepositories({
  providerId: storageProvider.providerId,
  storage: storageProvider,
});
const codingSessionRepositories = createBirdCoderCodingSessionRepositories({
  providerId: storageProvider.providerId,
  storage: storageProvider,
});
const service = new ProviderBackedProjectService({
  codingSessionRepositories,
  repository: appRepositories.projects,
});

const existingSession = buildSession(sessionId);

await appRepositories.projects.save({
  createdAt: timestamp,
  id: projectId,
  name: 'Session Create Upsert Inventory Laziness',
  status: 'active',
  updatedAt: timestamp,
  workspaceId,
});
await codingSessionRepositories.sessions.saveMany([
  existingSession,
  buildSession('session-create-upsert-inventory-laziness-peer'),
]);
await codingSessionRepositories.messages.saveMany([
  buildMessage(sessionId, 'session-create-upsert-message-a'),
  buildMessage(sessionId, 'session-create-upsert-message-b'),
]);

sqlExecutor.history.length = 0;
const createdSession = await service.createCodingSession(
  projectId,
  'New Session Without Transcript Scan',
  {
    engineId: 'codex',
    modelId: 'gpt-5.4',
  },
);
assert.equal(
  createdSession.messages.length,
  0,
  'new session creation should still return an empty transcript.',
);
assert.equal(
  countPlanKind('coding-session-messages-by-session-ids'),
  0,
  'creating one session must not read persisted transcript messages for every existing project session.',
);
assert.equal(
  sqlExecutor.history.some(
    (plan) =>
      plan.meta?.kind === 'table-list' &&
      plan.meta.tableName === 'ai_coding_session_message',
  ),
  false,
  'creating one session must not full-scan ai_coding_session_message.',
);

sqlExecutor.history.length = 0;
await service.upsertCodingSession(
  projectId,
  buildCodingSessionSummaryInput(existingSession, 'Summary Upsert Without Transcript Scan'),
);
assert.equal(
  countPlanKind('coding-session-messages-by-session-ids'),
  0,
  'summary-only upsert must not read persisted transcript messages for the whole project.',
);
assert.equal(
  countPlanKind('coding-session-messages-delete-by-session-ids'),
  0,
  'summary-only upsert must not delete an existing transcript just because the caller passed an inventory-shaped session.',
);
assert.equal(
  sqlExecutor.history.some(
    (plan) =>
      plan.meta?.kind === 'table-list' &&
      plan.meta.tableName === 'ai_coding_session_message',
  ),
  false,
  'summary-only upsert must not full-scan ai_coding_session_message.',
);

sqlExecutor.history.length = 0;
assert.deepEqual(
  (await codingSessionRepositories.listMessagesByCodingSessionIds([sessionId])).map(
    (message) => message.id,
  ),
  ['session-create-upsert-message-a', 'session-create-upsert-message-b'],
  'summary-only upsert must preserve the already persisted transcript.',
);

const providerBackedProjectServiceSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ProviderBackedProjectService.ts',
    import.meta.url,
  ),
  'utf8',
);

function extractPublicMethodSource(methodName: string): string {
  const methodStart = providerBackedProjectServiceSource.indexOf(
    `async ${methodName}(`,
  );
  assert.notEqual(
    methodStart,
    -1,
    `ProviderBackedProjectService must define ${methodName}.`,
  );
  const methodEnd = providerBackedProjectServiceSource.indexOf(
    '\n  async ',
    methodStart + 1,
  );
  return providerBackedProjectServiceSource.slice(
    methodStart,
    methodEnd === -1 ? providerBackedProjectServiceSource.length : methodEnd,
  );
}

const createCodingSessionSource = extractPublicMethodSource('createCodingSession');
assert.doesNotMatch(
  createCodingSessionSource,
  /readProjectSessions\(projectId,\s*\{\s*refresh:\s*true,\s*\}\)/s,
  'createCodingSession must not hydrate full project transcripts before inserting one new session.',
);
assert.match(
  createCodingSessionSource,
  /readProjectSessionInventoryCache\(projectId,\s*\{\s*refresh:\s*true,\s*\}\)/s,
  'createCodingSession must refresh only the lightweight session inventory cache.',
);

const upsertCodingSessionSource = extractPublicMethodSource('upsertCodingSession');
assert.doesNotMatch(
  upsertCodingSessionSource,
  /readProjectSessions\(projectId,\s*\{\s*refresh:\s*true,\s*\}\)/s,
  'upsertCodingSession must not hydrate full project transcripts before a summary or single-session write.',
);
assert.match(
  upsertCodingSessionSource,
  /readProjectSessionInventoryCache\(projectId,\s*\{\s*refresh:\s*true,\s*\}\)/s,
  'upsertCodingSession must refresh only the lightweight session inventory cache.',
);
assert.match(
  upsertCodingSessionSource,
  /if \(!shouldPreservePersistedTranscript\) \{[\s\S]*replacePersistedCodingSessionMessages\(/s,
  'upsertCodingSession must skip transcript replacement when the caller provided an inventory-shaped empty transcript.',
);

console.log('provider-backed session create/upsert inventory laziness performance contract passed.');
