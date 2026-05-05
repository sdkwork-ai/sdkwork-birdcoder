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

const workspaceId = 'workspace-selected-local-transcript';
const projectId = 'project-selected-local-transcript';
const otherProjectId = 'project-selected-local-transcript-other';
const codingSessionId = 'session-selected-local-transcript';
const otherCodingSessionId = 'session-selected-local-transcript-other';

function buildSession(
  id: string,
  project: string,
  updatedAt: string,
): BirdCoderPersistedCodingSessionRecord {
  return {
    archived: false,
    createdAt: updatedAt,
    engineId: 'codex',
    hostMode: 'desktop',
    id,
    lastTurnAt: updatedAt,
    modelId: 'gpt-5.4',
    pinned: false,
    projectId: project,
    status: 'active',
    title: id,
    transcriptUpdatedAt: updatedAt,
    unread: false,
    updatedAt,
    workspaceId,
  };
}

function buildMessage(
  sessionId: string,
  id: string,
  createdAt: string,
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

await appRepositories.projects.saveMany([
  {
    createdAt: '2026-04-29T00:00:00.000Z',
    id: projectId,
    name: 'Selected Local Transcript',
    status: 'active',
    updatedAt: '2026-04-29T00:00:00.000Z',
    workspaceId,
  },
  {
    createdAt: '2026-04-29T00:00:00.000Z',
    id: otherProjectId,
    name: 'Selected Local Transcript Other',
    status: 'active',
    updatedAt: '2026-04-29T00:00:00.000Z',
    workspaceId,
  },
]);

await codingSessionRepositories.sessions.saveMany([
  buildSession(codingSessionId, projectId, '2026-04-29T00:01:00.000Z'),
  buildSession(otherCodingSessionId, otherProjectId, '2026-04-29T00:02:00.000Z'),
]);
await codingSessionRepositories.messages.saveMany([
  buildMessage(codingSessionId, 'selected-message-1', '2026-04-29T00:01:01.000Z'),
  buildMessage(codingSessionId, 'selected-message-2', '2026-04-29T00:01:02.000Z'),
  buildMessage(otherCodingSessionId, 'other-message-1', '2026-04-29T00:02:01.000Z'),
]);

const service = new ProviderBackedProjectService({
  codingSessionRepositories,
  projectContentRepository: appRepositories.projectContents,
  repository: appRepositories.projects,
});

assert.equal(
  typeof service.getCodingSessionTranscript,
  'function',
  'ProviderBackedProjectService must expose a selected-session transcript reader.',
);

sqlExecutor.history.length = 0;
const hydratedSession = await service.getCodingSessionTranscript(
  projectId,
  codingSessionId,
);

assert.deepEqual(
  hydratedSession?.messages.map((message) => message.id),
  ['selected-message-1', 'selected-message-2'],
  'selected-session transcript hydration must load only the clicked session messages.',
);
assert.deepEqual(
  sqlExecutor.history.map((plan) => plan.meta?.kind),
  [
    'table-find-by-id',
    'coding-session-messages-by-session-ids',
  ],
  'selected-session transcript hydration must read the clicked session row by id before loading only its messages.',
);
assert.equal(
  sqlExecutor.history.some(
    (plan) => plan.meta?.kind === 'coding-session-list-by-project-ids',
  ),
  false,
  'selected-session transcript hydration must not read every session in the project before finding the clicked session.',
);
assert.equal(
  sqlExecutor.history.some(
    (plan) =>
      plan.meta?.kind === 'table-list' &&
      plan.meta.tableName === 'coding_session_messages',
  ),
  false,
  'selected-session transcript hydration must not full-scan coding_session_messages.',
);

sqlExecutor.history.length = 0;
const cachedHydratedSession = await service.getCodingSessionTranscript(
  projectId,
  codingSessionId,
);
assert.deepEqual(
  cachedHydratedSession?.messages.map((message) => message.id),
  ['selected-message-1', 'selected-message-2'],
  'repeated selected-session transcript hydration must reuse the hydrated in-memory transcript.',
);
assert.deepEqual(
  sqlExecutor.history,
  [],
  'repeated selected-session transcript hydration must not call local_sql_execute_plan after the transcript is cached.',
);

const hookSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useSelectedCodingSessionMessages.ts', import.meta.url),
  'utf8',
);

assert.match(
  hookSource,
  /projectService\.getCodingSessionTranscript/,
  'Selected-session hydration must use the local transcript reader before authority refreshes so clicked sessions render from local storage immediately.',
);
assert.doesNotMatch(
  fs.readFileSync(
    new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts', import.meta.url),
    'utf8',
  ),
  /getCodingSessionTranscript\([\s\S]*?listSessionsByProjectIds\(\s*\[\s*normalizedProjectId\s*,?\s*\]\s*\)/,
  'ProviderBackedProjectService.getCodingSessionTranscript must not project-scan sessions when a selected session id is already known.',
);
assert.match(
  hookSource,
  /upsertCodingSessionIntoProjectsStore\([\s\S]*localTranscriptCodingSession/s,
  'Selected-session local transcript hydration must upsert the hydrated session into the shared projects store.',
);
assert.match(
  hookSource,
  /const shouldSynchronizeAuthority =[\s\S]*shouldBootstrapFromAuthority[\s\S]*authorityFallbackRefreshTick > 0[\s\S]*!canUseWorkspaceRealtime/s,
  'Selected-session automatic authority reads must be gated behind bootstrap, realtime-unavailable fallback, or explicit refresh policy instead of every click.',
);

console.log('selected session local transcript hydration contract passed.');
