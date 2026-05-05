import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ProviderBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts';
import { createBirdCoderRepresentativeAppAdminRepositories } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts';
import {
  createBirdCoderCodingSessionRepositories,
  type BirdCoderPersistedCodingSessionRecord,
} from '../packages/sdkwork-birdcoder-infrastructure/src/storage/codingSessionRepository.ts';
import { createBirdCoderStorageProvider } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts';
import { createBirdCoderInMemorySqlExecutor } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/sqlExecutor.ts';
import type { BirdCoderChatMessage } from '../packages/sdkwork-birdcoder-types/src/index.ts';

const workspaceId = 'workspace-session-delete-performance';
const projectId = 'project-session-delete-performance';
const sessionId = 'session-delete-performance';
const timestamp = '2026-04-29T11:00:00.000Z';

function buildSession(): BirdCoderPersistedCodingSessionRecord {
  return {
    archived: false,
    createdAt: timestamp,
    engineId: 'codex',
    hostMode: 'desktop',
    id: sessionId,
    modelId: 'gpt-5.4',
    pinned: false,
    projectId,
    status: 'active',
    title: 'Session Delete Performance',
    transcriptUpdatedAt: timestamp,
    unread: false,
    updatedAt: timestamp,
    workspaceId,
  };
}

function buildMessage(id: string): BirdCoderChatMessage {
  return {
    codingSessionId: sessionId,
    content: id,
    createdAt: timestamp,
    id,
    role: 'assistant',
    timestamp: Date.parse(timestamp),
  };
}

function countPlanKind(kind: string): number {
  return sqlExecutor.history.filter((plan) => plan.meta?.kind === kind).length;
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
const service = new ProviderBackedProjectService({
  codingSessionRepositories,
  projectContentRepository: appRepositories.projectContents,
  repository: appRepositories.projects,
});

await appRepositories.projects.save({
  createdAt: timestamp,
  id: projectId,
  name: 'Session Delete Performance',
  status: 'active',
  updatedAt: timestamp,
  workspaceId,
});
await appRepositories.projectContents.save({
  configData: JSON.stringify({
    rootPath: 'D:/workspace/session-delete-performance',
  }),
  contentVersion: '1.0',
  createdAt: timestamp,
  id: projectId,
  projectId,
  updatedAt: timestamp,
});
await codingSessionRepositories.sessions.save(buildSession());
await codingSessionRepositories.messages.saveMany([
  buildMessage('session-delete-message-a'),
  buildMessage('session-delete-message-b'),
]);

sqlExecutor.history.length = 0;
await service.deleteCodingSession(projectId, sessionId);

assert.equal(
  countPlanKind('coding-session-messages-delete-by-session-ids'),
  1,
  'single session deletion must delete transcript messages with one session-scoped write plan.',
);
assert.equal(
  countPlanKind('coding-session-messages-by-session-ids'),
  0,
  'single session deletion must not read transcript messages before deleting them.',
);
assert.equal(
  sqlExecutor.history.some(
    (plan) =>
      plan.meta?.kind === 'table-list' &&
      plan.meta.tableName === 'coding_session_messages',
  ),
  false,
  'single session deletion must not full-scan coding_session_messages.',
);
assert.equal(
  (await codingSessionRepositories.sessions.findById(sessionId)),
  null,
  'single session deletion must remove the persisted session summary.',
);
assert.deepEqual(
  await codingSessionRepositories.listMessagesByCodingSessionIds([sessionId]),
  [],
  'single session deletion must remove every persisted transcript message.',
);

const providerBackedProjectServiceSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts', import.meta.url),
  'utf8',
);
const deletePersistedSessionMethodStart = providerBackedProjectServiceSource.indexOf(
  'private async deletePersistedCodingSession(',
);
assert.notEqual(
  deletePersistedSessionMethodStart,
  -1,
  'ProviderBackedProjectService must define deletePersistedCodingSession.',
);
const deletePersistedSessionMethodEnd = providerBackedProjectServiceSource.indexOf(
  '\n  private async ',
  deletePersistedSessionMethodStart + 1,
);
const deletePersistedSessionMethodSource = providerBackedProjectServiceSource.slice(
  deletePersistedSessionMethodStart,
  deletePersistedSessionMethodEnd === -1
    ? providerBackedProjectServiceSource.length
    : deletePersistedSessionMethodEnd,
);

assert.doesNotMatch(
  deletePersistedSessionMethodSource,
  /listMessagesByCodingSessionIds|deletePersistedCodingSessionMessage/,
  'ProviderBackedProjectService.deletePersistedCodingSession must not read and delete transcript messages one row at a time.',
);
assert.match(
  deletePersistedSessionMethodSource,
  /deleteMessagesByCodingSessionIds\(\s*\[\s*normalizedCodingSessionId,?\s*\]\s*\)/,
  'ProviderBackedProjectService.deletePersistedCodingSession must use the session-scoped transcript delete accelerator.',
);

console.log('provider-backed session delete performance contract passed.');
