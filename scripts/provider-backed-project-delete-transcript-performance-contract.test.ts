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

const workspaceId = 'workspace-project-delete-performance';
const projectId = 'project-delete-performance';
const timestamp = '2026-04-29T09:00:00.000Z';

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
    role: 'user',
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
  name: 'Project Delete Performance',
  status: 'active',
  updatedAt: timestamp,
  workspaceId,
});
await appRepositories.projectContents.save({
  configData: JSON.stringify({
    rootPath: 'D:/workspace/project-delete-performance',
  }),
  contentVersion: '1.0',
  createdAt: timestamp,
  id: projectId,
  projectId,
  updatedAt: timestamp,
});
await codingSessionRepositories.sessions.saveMany([
  buildSession('project-delete-session-a'),
  buildSession('project-delete-session-b'),
]);
await codingSessionRepositories.messages.saveMany([
  buildMessage('project-delete-session-a', 'project-delete-session-a-message-1'),
  buildMessage('project-delete-session-a', 'project-delete-session-a-message-2'),
  buildMessage('project-delete-session-b', 'project-delete-session-b-message-1'),
]);

sqlExecutor.history.length = 0;
await service.deleteProject(projectId);

assert.equal(
  countPlanKind('coding-session-messages-delete-by-project-ids'),
  1,
  'project deletion must delete all persisted transcript messages with one project-scoped write plan.',
);
assert.equal(
  countPlanKind('coding-session-delete-by-project-ids'),
  1,
  'project deletion must delete all persisted session summaries with one project-scoped write plan.',
);
assert.equal(
  countPlanKind('coding-session-list-by-project-ids'),
  0,
  'project deletion must not read session summaries before project-scoped deletes.',
);
assert.equal(
  countPlanKind('coding-session-messages-by-session-ids'),
  0,
  'project deletion must not read transcript messages before project-scoped deletes.',
);
assert.equal(
  sqlExecutor.history.some(
    (plan) =>
      plan.meta?.kind === 'table-list' &&
      plan.meta.tableName === 'coding_session_messages',
  ),
  false,
  'project deletion must not full-scan coding_session_messages.',
);
assert.deepEqual(
  (await codingSessionRepositories.messages.list()).filter((message) =>
    message.codingSessionId.startsWith('project-delete-session-'),
  ),
  [],
  'project deletion must still remove every persisted transcript message for deleted sessions.',
);

const providerBackedProjectServiceSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts', import.meta.url),
  'utf8',
);
const deleteProjectSessionsMethodStart = providerBackedProjectServiceSource.indexOf(
  'private async deletePersistedProjectSessions(',
);
assert.notEqual(
  deleteProjectSessionsMethodStart,
  -1,
  'ProviderBackedProjectService must define deletePersistedProjectSessions.',
);
const deleteProjectSessionsMethodEnd = providerBackedProjectServiceSource.indexOf(
  '\n  private async ',
  deleteProjectSessionsMethodStart + 1,
);
const deleteProjectSessionsMethodSource = providerBackedProjectServiceSource.slice(
  deleteProjectSessionsMethodStart,
  deleteProjectSessionsMethodEnd === -1
    ? providerBackedProjectServiceSource.length
    : deleteProjectSessionsMethodEnd,
);

assert.doesNotMatch(
  deleteProjectSessionsMethodSource,
  /listSessionsByProjectIds|loadPersistedCodingSessionsSnapshot/,
  'ProviderBackedProjectService.deletePersistedProjectSessions must not hydrate full session transcripts before deleting them.',
);
assert.doesNotMatch(
  deleteProjectSessionsMethodSource,
  /listMessagesByCodingSessionIds|deletePersistedCodingSession\(session\.id\)/,
  'ProviderBackedProjectService.deletePersistedProjectSessions must not read or delete transcript messages one session at a time.',
);
assert.match(
  deleteProjectSessionsMethodSource,
  /deleteMessagesByProjectIds\(\[\s*normalizedProjectId\s*\]\)/,
  'ProviderBackedProjectService.deletePersistedProjectSessions must use the project-scoped transcript delete accelerator.',
);
assert.match(
  deleteProjectSessionsMethodSource,
  /deleteSessionsByProjectIds\(\[\s*normalizedProjectId\s*\]\)/,
  'ProviderBackedProjectService.deletePersistedProjectSessions must use the project-scoped session delete accelerator.',
);

console.log('provider-backed project delete transcript performance contract passed.');
