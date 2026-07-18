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
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';

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

function buildMessage(
  sessionId: string,
  id: string,
  createdAt: string = timestamp,
): BirdCoderChatMessage {
  return {
    codingSessionId: sessionId,
    content: id,
    createdAt,
    id,
    role: 'assistant',
    timestamp: Date.parse(createdAt),
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

function countCodingSessionSummaryWrites(): number {
  return sqlExecutor.history.filter(
    (plan) =>
      plan.meta?.kind === 'table-upsert' &&
      plan.meta.tableName === 'ai_coding_session',
  ).length;
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

const staleGuardSessionId = 'session-create-upsert-stale-summary-guard';
const cachedNewerUpdatedAt = '2026-04-30T10:20:00.000Z';
const cachedNewerLastTurnAt = '2026-04-30T10:19:00.000Z';
const cachedNewerSortTimestamp = String(Date.parse(cachedNewerLastTurnAt));
const cachedNewerTranscriptUpdatedAt = '2026-04-30T10:18:00.000Z';
const cachedNewerTitle = 'Cached Newer Session Title';
const staleAuthorityNativeSessionId = 'native-session-summary-backfill';
const staleGuardMessageIds = [
  'session-create-upsert-stale-message-a',
  'session-create-upsert-stale-message-b',
];
const cachedNewerSession: BirdCoderPersistedCodingSessionRecord = {
  ...buildSession(staleGuardSessionId),
  lastTurnAt: cachedNewerLastTurnAt,
  sortTimestamp: cachedNewerSortTimestamp,
  title: cachedNewerTitle,
  transcriptUpdatedAt: cachedNewerTranscriptUpdatedAt,
  updatedAt: cachedNewerUpdatedAt,
};

await codingSessionRepositories.sessions.save(cachedNewerSession);
await codingSessionRepositories.messages.saveMany([
  buildMessage(
    staleGuardSessionId,
    staleGuardMessageIds[0]!,
    '2026-04-30T10:17:00.000Z',
  ),
  buildMessage(
    staleGuardSessionId,
    staleGuardMessageIds[1]!,
    cachedNewerTranscriptUpdatedAt,
  ),
]);

const hydratedNewerSession = await service.getCodingSessionTranscript(
  projectId,
  staleGuardSessionId,
);
assert.ok(
  hydratedNewerSession,
  'stale-summary guard setup must hydrate the newer cached session.',
);
assert.deepEqual(
  hydratedNewerSession.messages.map((message) => message.id),
  staleGuardMessageIds,
  'stale-summary guard setup must cache the complete newer transcript.',
);

const staleAuthoritySummary: BirdCoderCodingSession = {
  ...hydratedNewerSession,
  lastTurnAt: '2026-04-30T10:04:00.000Z',
  messages: [],
  nativeSessionId: staleAuthorityNativeSessionId,
  sortTimestamp: String(Date.parse('2026-04-30T10:04:00.000Z')),
  title: 'Stale Authority Session Title',
  transcriptUpdatedAt: '2026-04-30T10:03:00.000Z',
  updatedAt: '2026-04-30T10:05:00.000Z',
};

sqlExecutor.history.length = 0;
await service.upsertCodingSession(projectId, staleAuthoritySummary);
assert.equal(
  countCodingSessionSummaryWrites(),
  1,
  'a stale authority summary may persist once when it backfills a missing native session id.',
);

const persistedAfterStaleSummary =
  await codingSessionRepositories.sessions.findById(staleGuardSessionId);
assert.ok(
  persistedAfterStaleSummary,
  'the stale-summary guard session must remain persisted.',
);
assert.equal(
  persistedAfterStaleSummary.nativeSessionId,
  staleAuthorityNativeSessionId,
  'the stale authority summary must be allowed to backfill nativeSessionId.',
);
assert.equal(
  persistedAfterStaleSummary.title,
  cachedNewerTitle,
  'a stale authority summary must not replace the newer cached title.',
);
assert.equal(
  persistedAfterStaleSummary.updatedAt,
  cachedNewerUpdatedAt,
  'a stale authority summary must not replace the newer cached updatedAt.',
);
assert.equal(
  persistedAfterStaleSummary.lastTurnAt,
  cachedNewerLastTurnAt,
  'a stale authority summary must not replace the newer cached lastTurnAt.',
);
assert.equal(
  persistedAfterStaleSummary.sortTimestamp,
  cachedNewerSortTimestamp,
  'a stale authority summary must not replace the newer cached sortTimestamp.',
);
assert.equal(
  persistedAfterStaleSummary.transcriptUpdatedAt,
  cachedNewerTranscriptUpdatedAt,
  'a stale authority summary must not replace the newer cached transcript timestamp.',
);

const cachedAfterStaleSummary = await service.getCodingSessionTranscript(
  projectId,
  staleGuardSessionId,
);
assert.ok(
  cachedAfterStaleSummary,
  'the guarded session must remain available from the selected-session cache.',
);
assert.equal(
  cachedAfterStaleSummary.title,
  cachedNewerTitle,
  'the selected-session cache must retain the newer title.',
);
assert.equal(
  cachedAfterStaleSummary.updatedAt,
  cachedNewerUpdatedAt,
  'the selected-session cache must retain the newer updatedAt.',
);
assert.equal(
  cachedAfterStaleSummary.lastTurnAt,
  cachedNewerLastTurnAt,
  'the selected-session cache must retain the newer lastTurnAt.',
);
assert.equal(
  cachedAfterStaleSummary.sortTimestamp,
  cachedNewerSortTimestamp,
  'the selected-session cache must retain the newer sortTimestamp.',
);
assert.equal(
  cachedAfterStaleSummary.transcriptUpdatedAt,
  cachedNewerTranscriptUpdatedAt,
  'the selected-session cache must retain the newer transcript timestamp.',
);
assert.deepEqual(
  cachedAfterStaleSummary.messages.map((message) => message.id),
  staleGuardMessageIds,
  'a stale authority summary must not replace the newer cached transcript messages.',
);
assert.deepEqual(
  (
    await codingSessionRepositories.listMessagesByCodingSessionIds([
      staleGuardSessionId,
    ])
  ).map((message) => message.id),
  staleGuardMessageIds,
  'a stale authority summary must not replace the persisted transcript messages.',
);

sqlExecutor.history.length = 0;
await service.upsertCodingSession(projectId, staleAuthoritySummary);
assert.equal(
  countCodingSessionSummaryWrites(),
  0,
  'replaying an equivalent stale authority summary must not persist the session again.',
);
assert.equal(
  sqlExecutor.history.some((plan) => plan.intent === 'write'),
  false,
  'replaying an equivalent stale authority summary must not emit any redundant persistence plan.',
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
