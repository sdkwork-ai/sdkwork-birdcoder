import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ProviderBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts';
import { createBirdCoderRepresentativeAppAdminRepositories } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts';
import { createBirdCoderCodingSessionRepositories } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/codingSessionRepository.ts';
import { createBirdCoderStorageProvider } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts';
import { createBirdCoderInMemorySqlExecutor } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/sqlExecutor.ts';

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

const project = await service.createProject(
  'workspace-message-append-performance',
  'Message Append Performance',
  {
    path: 'D:/workspace/message-append-performance',
  },
);
const session = await service.createCodingSession(project.id, 'Hot Append Session', {
  engineId: 'codex',
  modelId: 'gpt-5.4',
});

sqlExecutor.history.length = 0;
await service.addCodingSessionMessage(project.id, session.id, {
  content: 'first hot append',
  id: 'first-hot-append-message',
  role: 'user',
});
await service.addCodingSessionMessage(project.id, session.id, {
  content: 'second hot append',
  id: 'second-hot-append-message',
  role: 'assistant',
});

assert.equal(
  countPlanKind('coding-session-messages-by-session-ids'),
  0,
  'hot message append must not read the full persisted transcript before every write.',
);
assert.equal(
  sqlExecutor.history.some(
    (plan) =>
      plan.meta?.kind === 'table-list' &&
      plan.meta.tableName === 'coding_session_messages',
  ),
  false,
  'hot message append must not full-scan coding_session_messages.',
);

const messageUpsertPlans = sqlExecutor.history.filter(
  (plan) =>
    plan.meta?.kind === 'table-upsert' &&
    plan.meta.tableName === 'coding_session_messages',
);
assert.equal(
  messageUpsertPlans.length,
  2,
  'each hot message append should persist exactly one message write plan.',
);
assert.deepEqual(
  messageUpsertPlans.map((plan) => plan.meta?.kind === 'table-upsert' ? plan.meta.rows.length : 0),
  [1, 1],
  'hot message append must not rewrite the whole transcript payload as it grows.',
);

const hydratedTranscript = await service.getCodingSessionTranscript(project.id, session.id);
assert.deepEqual(
  hydratedTranscript?.messages.map((message) => message.id),
  ['first-hot-append-message', 'second-hot-append-message'],
  'hot append must keep the in-memory transcript complete for the selected session.',
);

const providerBackedProjectServiceSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts', import.meta.url),
  'utf8',
);
const addMessageMethodStart = providerBackedProjectServiceSource.indexOf(
  'async addCodingSessionMessage(',
);
assert.notEqual(
  addMessageMethodStart,
  -1,
  'ProviderBackedProjectService must define addCodingSessionMessage.',
);
const addMessageMethodEnd = providerBackedProjectServiceSource.indexOf(
  '\n  async ',
  addMessageMethodStart + 1,
);
const addMessageMethodSource = providerBackedProjectServiceSource.slice(
  addMessageMethodStart,
  addMessageMethodEnd === -1
    ? providerBackedProjectServiceSource.length
    : addMessageMethodEnd,
);

assert.doesNotMatch(
  addMessageMethodSource,
  /refresh:\s*true/,
  'ProviderBackedProjectService.addCodingSessionMessage must not force a full transcript refresh for hot appends.',
);
assert.doesNotMatch(
  addMessageMethodSource,
  /replacePersistedCodingSessionMessages/,
  'ProviderBackedProjectService.addCodingSessionMessage must not rewrite and reread the whole persisted transcript for append writes.',
);
assert.doesNotMatch(
  addMessageMethodSource,
  /deduplicateCodingSessionMessages\(/,
  'ProviderBackedProjectService.addCodingSessionMessage must not rescan the whole transcript for dedupe after it has already checked exact and logical message matches.',
);
assert.match(
  addMessageMethodSource,
  /persistCodingSessionMessage\(/,
  'ProviderBackedProjectService.addCodingSessionMessage must persist only the appended or merged message row.',
);

console.log('provider-backed session message append performance contract passed.');
