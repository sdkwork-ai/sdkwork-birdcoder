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

const workspaceId = 'workspace-inventory-cached-transcript-isolation';
const projectId = 'project-inventory-cached-transcript-isolation';
const codingSessionId = 'session-inventory-cached-transcript-isolation';
const timestamp = '2026-04-29T11:00:00.000Z';

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
    title: 'Inventory Cached Transcript Isolation',
    transcriptUpdatedAt: '2026-04-29T11:00:02.000Z',
    unread: false,
    updatedAt: timestamp,
    workspaceId,
  };
}

function buildMessage(id: string, createdAt: string): BirdCoderChatMessage {
  return {
    codingSessionId,
    content: id.repeat(128),
    createdAt,
    id,
    metadata: {
      nested: {
        id,
      },
    },
    role: 'assistant',
    timestamp: Date.parse(createdAt),
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
  name: 'Inventory Cached Transcript Isolation',
  status: 'active',
  updatedAt: timestamp,
  workspaceId,
});
await codingSessionRepositories.sessions.save(buildSession());
await codingSessionRepositories.messages.saveMany([
  buildMessage('inventory-cached-transcript-message-1', '2026-04-29T11:00:01.000Z'),
  buildMessage('inventory-cached-transcript-message-2', '2026-04-29T11:00:02.000Z'),
]);

const hydratedTranscript = await service.getCodingSessionTranscript(projectId, codingSessionId);
assert.deepEqual(
  hydratedTranscript?.messages.map((message) => message.id),
  [
    'inventory-cached-transcript-message-1',
    'inventory-cached-transcript-message-2',
  ],
  'test setup must hydrate and cache the selected-session transcript first.',
);

sqlExecutor.history.length = 0;
const projects = await service.getProjects(workspaceId);
const listedSession = projects
  .find((project) => project.id === projectId)
  ?.codingSessions.find((session) => session.id === codingSessionId);

assert.ok(listedSession, 'project inventory must still include the cached selected session.');
assert.deepEqual(
  listedSession.messages,
  [],
  'project inventory must never expose cached selected-session message bodies after transcript hydration.',
);
assert.equal(
  countPlanKind('coding-session-messages-by-session-ids'),
  0,
  'project inventory must not reread transcript messages just because a selected-session transcript is cached.',
);

sqlExecutor.history.length = 0;
const project = await service.getProjectById(projectId);
const projectByIdSession = project?.codingSessions.find(
  (session) => session.id === codingSessionId,
);

assert.ok(projectByIdSession, 'single-project inventory must still include the cached selected session.');
assert.deepEqual(
  projectByIdSession.messages,
  [],
  'single-project inventory must not deep-clone cached selected-session message bodies into project details.',
);
assert.equal(
  countPlanKind('coding-session-messages-by-session-ids'),
  0,
  'single-project inventory must stay on lightweight metadata reads after transcript hydration.',
);

const source = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts', import.meta.url),
  'utf8',
);
const methodStart = source.indexOf('private async loadPersistedCodingSessionInventorySnapshot(');
assert.notEqual(methodStart, -1, 'ProviderBackedProjectService must define loadPersistedCodingSessionInventorySnapshot.');
const methodEnd = source.indexOf('\n  private async ', methodStart + 1);
const methodSource = source.slice(
  methodStart,
  methodEnd === -1 ? source.length : methodEnd,
);

assert.match(
  methodSource,
  /projectInventorySessions\.push\(inventorySession\);/,
  'public inventory results must append the lightweight inventory session, not the cached hydrated transcript.',
);
assert.doesNotMatch(
  methodSource,
  /projectInventorySessions\.push\(\s*canReuseCachedTranscript[\s\S]*?cacheSession[\s\S]*?:\s*inventorySession,\s*\);/,
  'public inventory results must not branch to cached hydrated transcript sessions.',
);
assert.match(
  methodSource,
  /projectCachedInventorySessions\.push\(cacheSession\);/,
  'internal project cache may still preserve the hydrated transcript separately for fast repeated selected-session reads.',
);

console.log('provider-backed project inventory cached transcript isolation performance contract passed.');
