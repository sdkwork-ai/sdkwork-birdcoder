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

const workspaceId = 'workspace-selected-inventory-transcript-metadata';
const projectId = 'project-selected-inventory-transcript-metadata';
const codingSessionId = 'session-selected-inventory-transcript-metadata';
const initialTimestamp = '2026-04-29T00:01:00.000Z';
const latestTimestamp = '2026-04-29T00:02:00.000Z';

function buildSession(): BirdCoderPersistedCodingSessionRecord {
  return {
    archived: false,
    createdAt: initialTimestamp,
    engineId: 'codex',
    hostMode: 'desktop',
    id: codingSessionId,
    lastTurnAt: initialTimestamp,
    modelId: 'gpt-5.4',
    pinned: false,
    projectId,
    status: 'active',
    title: 'Selected Inventory Transcript Metadata',
    transcriptUpdatedAt: initialTimestamp,
    unread: false,
    updatedAt: initialTimestamp,
    workspaceId,
  };
}

function buildMessage(id: string, createdAt: string): BirdCoderChatMessage {
  return {
    codingSessionId,
    content: id,
    createdAt,
    id,
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

await appRepositories.projects.save({
  createdAt: initialTimestamp,
  id: projectId,
  name: 'Selected Inventory Transcript Metadata',
  status: 'active',
  updatedAt: initialTimestamp,
  workspaceId,
});
await codingSessionRepositories.sessions.save(buildSession());
await codingSessionRepositories.messages.saveMany([
  buildMessage('selected-inventory-message-1', initialTimestamp),
  buildMessage('selected-inventory-message-2', latestTimestamp),
]);

const service = new ProviderBackedProjectService({
  codingSessionRepositories,
  projectContentRepository: appRepositories.projectContents,
  repository: appRepositories.projects,
});

sqlExecutor.history.length = 0;
const projects = await service.getProjects(workspaceId);
const inventorySession = projects
  .find((project) => project.id === projectId)
  ?.codingSessions.find((session) => session.id === codingSessionId);

assert.equal(
  inventorySession?.transcriptUpdatedAt,
  latestTimestamp,
  'project inventory must expose the latest transcript timestamp from message metadata even when the session summary timestamp is stale.',
);
assert.deepEqual(
  inventorySession?.messages,
  [],
  'project inventory must still avoid loading selected-session message bodies while reading transcript freshness metadata.',
);
assert.equal(
  countPlanKind('coding-session-message-metadata-by-session-ids'),
  1,
  'project inventory must read lightweight message metadata so selected-session loading can detect stale cached transcripts.',
);
assert.equal(
  countPlanKind('coding-session-messages-by-session-ids'),
  0,
  'project inventory must not read transcript message bodies to detect latest selected-session transcript freshness.',
);
assert.equal(
  sqlExecutor.history.some(
    (plan) =>
      plan.meta?.kind === 'table-list' &&
      plan.meta.tableName === 'coding_session_messages',
  ),
  false,
  'project inventory transcript freshness must not full-scan coding_session_messages.',
);

sqlExecutor.history.length = 0;
const hydratedTranscript = await service.getCodingSessionTranscript(
  projectId,
  codingSessionId,
  { expectedTranscriptUpdatedAt: inventorySession?.transcriptUpdatedAt ?? null },
);

assert.equal(
  hydratedTranscript?.transcriptUpdatedAt,
  latestTimestamp,
  'selected-session transcript hydration must publish the latest message timestamp when the persisted session summary timestamp is stale.',
);
assert.deepEqual(
  hydratedTranscript?.messages.map((message) => message.id),
  ['selected-inventory-message-1', 'selected-inventory-message-2'],
  'selected-session transcript hydration must load the latest local code-engine messages after inventory metadata marks the transcript stale.',
);
assert.deepEqual(
  sqlExecutor.history.map((plan) => plan.meta?.kind),
  ['table-find-by-id', 'coding-session-messages-by-session-ids'],
  'selected-session latest transcript hydration must remain a precise by-id session read plus one clicked-session message read.',
);

console.log('selected session inventory transcript metadata contract passed.');
