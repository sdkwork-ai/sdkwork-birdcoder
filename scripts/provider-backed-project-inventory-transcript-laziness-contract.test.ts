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

const workspaceId = 'workspace-project-inventory-laziness';
const projectId = 'project-inventory-laziness';
const timestamp = '2026-04-29T10:00:00.000Z';

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
  name: 'Project Inventory Laziness',
  status: 'active',
  updatedAt: timestamp,
  workspaceId,
});
await appRepositories.projectContents.save({
  configData: JSON.stringify({
    rootPath: 'D:/workspace/project-inventory-laziness',
  }),
  contentVersion: '1.0',
  createdAt: timestamp,
  id: projectId,
  projectId,
  updatedAt: timestamp,
});
await codingSessionRepositories.sessions.saveMany([
  buildSession('project-inventory-session-a'),
  buildSession('project-inventory-session-b'),
]);
await codingSessionRepositories.messages.saveMany([
  buildMessage('project-inventory-session-a', 'project-inventory-session-a-message-1'),
  buildMessage('project-inventory-session-a', 'project-inventory-session-a-message-2'),
  buildMessage('project-inventory-session-b', 'project-inventory-session-b-message-1'),
]);

sqlExecutor.history.length = 0;
const projects = await service.getProjects(workspaceId);
const inventoryProject = projects.find((project) => project.id === projectId);

assert.ok(inventoryProject, 'project inventory must still include the persisted project.');
assert.deepEqual(
  inventoryProject.codingSessions.map((session) => session.id).sort(),
  ['project-inventory-session-a', 'project-inventory-session-b'],
  'project inventory must still include persisted session summaries.',
);
assert.deepEqual(
  inventoryProject.codingSessions.flatMap((session) => session.messages),
  [],
  'project inventory must not hydrate transcript message bodies during sidebar/startup reads.',
);
assert.equal(
  countPlanKind('coding-session-list-by-project-ids'),
  1,
  'project inventory should load session summaries with one project-scoped SQL read.',
);
assert.equal(
  countPlanKind('coding-session-messages-by-session-ids'),
  0,
  'project inventory must not read transcript messages for every listed session.',
);
assert.equal(
  sqlExecutor.history.some(
    (plan) =>
      plan.meta?.kind === 'table-list' &&
      plan.meta.tableName === 'coding_session_messages',
  ),
  false,
  'project inventory must not full-scan coding_session_messages.',
);

sqlExecutor.history.length = 0;
const hydratedTranscript = await service.getCodingSessionTranscript(
  projectId,
  'project-inventory-session-a',
);
assert.deepEqual(
  hydratedTranscript?.messages.map((message) => message.id),
  [
    'project-inventory-session-a-message-1',
    'project-inventory-session-a-message-2',
  ],
  'selected session transcript hydration must still load local messages on demand.',
);
assert.equal(
  countPlanKind('coding-session-messages-by-session-ids'),
  1,
  'selected session transcript hydration should read messages only for the clicked session.',
);

const providerBackedProjectServiceSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts', import.meta.url),
  'utf8',
);

const inventorySnapshotMethodStart = providerBackedProjectServiceSource.indexOf(
  'private async loadPersistedCodingSessionInventorySnapshot(',
);
assert.notEqual(
  inventorySnapshotMethodStart,
  -1,
  'ProviderBackedProjectService must define loadPersistedCodingSessionInventorySnapshot.',
);
const inventorySnapshotMethodEnd = providerBackedProjectServiceSource.indexOf(
  '\n  private async ',
  inventorySnapshotMethodStart + 1,
);
const inventorySnapshotMethodSource = providerBackedProjectServiceSource.slice(
  inventorySnapshotMethodStart,
  inventorySnapshotMethodEnd === -1
    ? providerBackedProjectServiceSource.length
    : inventorySnapshotMethodEnd,
);

assert.doesNotMatch(
  inventorySnapshotMethodSource,
  /cachedSession\.messages\.map\(\s*\(message\)\s*=>\s*cloneChatMessage\(message\)\s*\)/s,
  'project inventory refresh must not deep-clone a hydrated selected-session transcript just to preserve the in-memory cache.',
);
assert.match(
  inventorySnapshotMethodSource,
  /messages:\s*cachedSession\.messages/,
  'project inventory refresh should reuse the already isolated cached transcript message array when timestamps match.',
);

for (const methodName of ['getProjects', 'getProjectById', 'getProjectByPath']) {
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
  const methodSource = providerBackedProjectServiceSource.slice(
    methodStart,
    methodEnd === -1 ? providerBackedProjectServiceSource.length : methodEnd,
  );

  assert.doesNotMatch(
    methodSource,
    /loadPersistedCodingSessionsSnapshot/,
    `${methodName} must not hydrate full transcripts for project inventory reads.`,
  );
  assert.match(
    methodSource,
    /loadPersistedCodingSessionInventorySnapshot/,
    `${methodName} must use the lightweight persisted session inventory snapshot.`,
  );
}

console.log('provider-backed project inventory transcript laziness contract passed.');
