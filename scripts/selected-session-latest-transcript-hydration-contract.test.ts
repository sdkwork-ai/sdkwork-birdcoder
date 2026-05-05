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

const workspaceId = 'workspace-selected-latest-transcript';
const projectId = 'project-selected-latest-transcript';
const codingSessionId = 'session-selected-latest-transcript';
const initialTimestamp = '2026-04-29T00:01:00.000Z';
const latestTimestamp = '2026-04-29T00:02:00.000Z';

function buildSession(transcriptUpdatedAt: string): BirdCoderPersistedCodingSessionRecord {
  return {
    archived: false,
    createdAt: initialTimestamp,
    engineId: 'codex',
    hostMode: 'desktop',
    id: codingSessionId,
    lastTurnAt: transcriptUpdatedAt,
    modelId: 'gpt-5.4',
    pinned: false,
    projectId,
    status: 'active',
    title: 'Selected Latest Transcript',
    transcriptUpdatedAt,
    unread: false,
    updatedAt: transcriptUpdatedAt,
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
  name: 'Selected Latest Transcript',
  status: 'active',
  updatedAt: initialTimestamp,
  workspaceId,
});
await codingSessionRepositories.sessions.save(buildSession(initialTimestamp));
await codingSessionRepositories.messages.save(
  buildMessage('selected-latest-message-1', initialTimestamp),
);

const service = new ProviderBackedProjectService({
  codingSessionRepositories,
  projectContentRepository: appRepositories.projectContents,
  repository: appRepositories.projects,
});

const initialTranscript = await service.getCodingSessionTranscript(projectId, codingSessionId);
assert.deepEqual(
  initialTranscript?.messages.map((message) => message.id),
  ['selected-latest-message-1'],
  'initial selected-session transcript read must hydrate the persisted local transcript.',
);

await codingSessionRepositories.sessions.save(buildSession(latestTimestamp));
await codingSessionRepositories.messages.save(
  buildMessage('selected-latest-message-2', latestTimestamp),
);

sqlExecutor.history.length = 0;
const latestTranscript = await service.getCodingSessionTranscript(
  projectId,
  codingSessionId,
  { expectedTranscriptUpdatedAt: latestTimestamp },
);

assert.deepEqual(
  latestTranscript?.messages.map((message) => message.id),
  ['selected-latest-message-1', 'selected-latest-message-2'],
  'selected-session transcript hydration must reload from local code-engine storage when the expected transcript timestamp is newer than the cached transcript.',
);
assert.deepEqual(
  sqlExecutor.history.map((plan) => plan.meta?.kind),
  ['table-find-by-id', 'coding-session-messages-by-session-ids'],
  'newer selected-session transcript hydration must remain a precise by-id session read plus one clicked-session message read.',
);

sqlExecutor.history.length = 0;
const cachedLatestTranscript = await service.getCodingSessionTranscript(
  projectId,
  codingSessionId,
  { expectedTranscriptUpdatedAt: latestTimestamp },
);

assert.equal(
  cachedLatestTranscript,
  latestTranscript,
  'repeated selected-session reads with the same expected transcript timestamp must reuse the public transcript snapshot.',
);
assert.deepEqual(
  sqlExecutor.history,
  [],
  'repeated selected-session reads with the same expected transcript timestamp must not call local_sql_execute_plan.',
);

const selectedMessagesHookSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useSelectedCodingSessionMessages.ts', import.meta.url),
  'utf8',
);

assert.match(
  selectedMessagesHookSource,
  /function shouldHydrateSelectedCodingSessionTranscript\(/,
  'Selected-session message loading must centralize the local transcript freshness decision.',
);
assert.doesNotMatch(
  selectedMessagesHookSource,
  /const shouldHydrateLocalTranscript =[\s\S]*resolvedCodingSession\.messages\.length === 0[\s\S]*Boolean\(localTranscriptReader\);/,
  'Selected-session message loading must not restrict local transcript hydration to empty message arrays, because stale non-empty transcripts must refresh from local code-engine storage.',
);
assert.match(
  selectedMessagesHookSource,
  /expectedTranscriptUpdatedAt:\s*resolvedCodingSession\?\.transcriptUpdatedAt \?\? null/,
  'Selected-session local transcript reads must pass the selected session transcript timestamp so the service can detect stale cached messages without polling full transcripts.',
);

console.log('selected session latest transcript hydration contract passed.');
