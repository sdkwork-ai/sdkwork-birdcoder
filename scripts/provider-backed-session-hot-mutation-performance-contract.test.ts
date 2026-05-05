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
  'workspace-hot-mutation-performance',
  'Hot Mutation Performance',
  {
    path: 'D:/workspace/hot-mutation-performance',
  },
);
const session = await service.createCodingSession(project.id, 'Hot Mutation Session', {
  engineId: 'codex',
  modelId: 'gpt-5.4',
});
await service.addCodingSessionMessage(project.id, session.id, {
  content: 'message before edit',
  id: 'hot-mutation-message-edit',
  role: 'user',
});
await service.addCodingSessionMessage(project.id, session.id, {
  content: 'message before delete',
  id: 'hot-mutation-message-delete',
  role: 'assistant',
});

sqlExecutor.history.length = 0;
await service.renameCodingSession(project.id, session.id, 'Hot Mutation Session Renamed');
await service.updateCodingSession(project.id, session.id, {
  pinned: true,
});
await service.editCodingSessionMessage(
  project.id,
  session.id,
  'hot-mutation-message-edit',
  {
    content: 'message after edit',
  },
);
await service.deleteCodingSessionMessage(
  project.id,
  session.id,
  'hot-mutation-message-delete',
);

assert.equal(
  countPlanKind('coding-session-messages-by-session-ids'),
  0,
  'hot rename/update/edit/delete operations must not reread the full persisted transcript when the session cache is already hydrated.',
);
assert.equal(
  sqlExecutor.history.some(
    (plan) =>
      plan.meta?.kind === 'table-list' &&
      plan.meta.tableName === 'coding_session_messages',
  ),
  false,
  'hot rename/update/edit/delete operations must not full-scan coding_session_messages.',
);

const hydratedTranscript = await service.getCodingSessionTranscript(project.id, session.id);
assert.deepEqual(
  hydratedTranscript?.messages.map((message) => [message.id, message.content]),
  [['hot-mutation-message-edit', 'message after edit']],
  'hot edit/delete operations must keep the selected transcript cache correct.',
);

const providerBackedProjectServiceSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts', import.meta.url),
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

function extractPrivateMethodSource(methodName: string): string {
  const methodStart = providerBackedProjectServiceSource.indexOf(
    `private ${methodName}(`,
  );
  assert.notEqual(
    methodStart,
    -1,
    `ProviderBackedProjectService must define ${methodName}.`,
  );
  const nextPublicMethodStart = providerBackedProjectServiceSource.indexOf(
    '\n  async ',
    methodStart + 1,
  );
  const nextPrivateMethodStart = providerBackedProjectServiceSource.indexOf(
    '\n  private ',
    methodStart + 1,
  );
  const methodEndCandidates = [nextPublicMethodStart, nextPrivateMethodStart].filter(
    (index) => index > methodStart,
  );
  const methodEnd =
    methodEndCandidates.length > 0
      ? Math.min(...methodEndCandidates)
      : providerBackedProjectServiceSource.length;
  return providerBackedProjectServiceSource.slice(methodStart, methodEnd);
}

for (const methodName of [
  'renameCodingSession',
  'updateCodingSession',
  'editCodingSessionMessage',
  'deleteCodingSessionMessage',
]) {
  const methodSource = extractPublicMethodSource(methodName);
  assert.doesNotMatch(
    methodSource,
    /refresh:\s*true/,
    `${methodName} must not force full transcript refresh for hot session mutations.`,
  );
  assert.doesNotMatch(
    methodSource,
    /cloneCodingSession\(codingSession\)/,
    `${methodName} must not structuredClone the whole transcript for metadata or single-message mutations.`,
  );
}

const addCodingSessionMessageSource = extractPublicMethodSource('addCodingSessionMessage');
assert.doesNotMatch(
  addCodingSessionMessageSource,
  /codingSession\.messages\.map\(\s*\(candidate(?:,\s*index)?\)\s*=>/s,
  'addCodingSessionMessage must not rebuild or clone the full transcript array for a single append or merge.',
);
assert.match(
  addCodingSessionMessageSource,
  /appendCodingSessionMessageByCopy\(/,
  'addCodingSessionMessage must append by copying the message array once and preserving existing message object references.',
);
assert.match(
  addCodingSessionMessageSource,
  /replaceCodingSessionMessageAtIndex\(/,
  'addCodingSessionMessage must merge an existing logical message with indexed replacement instead of remapping the transcript.',
);

const editCodingSessionMessageSource = extractPublicMethodSource('editCodingSessionMessage');
assert.doesNotMatch(
  editCodingSessionMessageSource,
  /codingSession\.messages\.map\(/,
  'editCodingSessionMessage must replace one message by index instead of remapping the full transcript.',
);
assert.match(
  editCodingSessionMessageSource,
  /replaceCodingSessionMessageAtIndex\(/,
  'editCodingSessionMessage must use indexed message replacement for single-message edits.',
);

const deleteCodingSessionMessageSource = extractPublicMethodSource('deleteCodingSessionMessage');
assert.doesNotMatch(
  deleteCodingSessionMessageSource,
  /\.filter\(\s*\(message\)\s*=>\s*message\.id\s*!==\s*messageId\s*\)\s*\.map\(/s,
  'deleteCodingSessionMessage must not filter and then clone/map the full transcript for one deletion.',
);
assert.match(
  deleteCodingSessionMessageSource,
  /removeCodingSessionMessageAtIndex\(/,
  'deleteCodingSessionMessage must remove one message by index with a single shallow array copy.',
);

const replaceCachedCodingSessionSource = extractPrivateMethodSource(
  'replaceCachedCodingSession',
);
assert.doesNotMatch(
  replaceCachedCodingSessionSource,
  /sortCodingSessionsByActivity\(/,
  'replaceCachedCodingSession must not re-sort every session after each hot message mutation.',
);
assert.doesNotMatch(
  replaceCachedCodingSessionSource,
  /currentSessions\.filter\(/,
  'replaceCachedCodingSession must not filter every session after each hot message mutation.',
);
assert.match(
  replaceCachedCodingSessionSource,
  /upsertCodingSessionByActivity\(/,
  'replaceCachedCodingSession must update the sorted cache through indexed upsert instead of full filter/sort.',
);

assert.match(
  providerBackedProjectServiceSource,
  /private async findCodingSessionWithTranscript\(/,
  'ProviderBackedProjectService must keep an explicit cache-first transcript resolver for mutations that require message bodies.',
);

console.log('provider-backed session hot mutation performance contract passed.');
