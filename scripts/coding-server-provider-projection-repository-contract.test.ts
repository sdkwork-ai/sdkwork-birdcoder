import assert from 'node:assert/strict';

import type { ChatMessage } from '../packages/sdkwork-birdcoder-chat/src/types.ts';
import {
  createBirdCoderStorageProvider,
  createBirdCoderTableRecordRepository,
} from '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts';
import { getBirdCoderSchemaMigrationDefinition } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts';
import {
  BIRDCODER_CODING_SESSION_RUNTIME_STORAGE_BINDING,
  getBirdCoderEntityDefinition,
} from '../packages/sdkwork-birdcoder-types/src/index.ts';
import {
  executeBirdCoderCoreSessionRun,
  persistBirdCoderCoreSessionRunProjection,
} from '../packages/sdkwork-birdcoder-server/src/index.ts';
import { createProviderBackedBirdCoderCoreSessionProjectionStore } from '../packages/sdkwork-birdcoder-server/src/projectionRepository.ts';
import { withMockCodexCliJsonl } from './test-support/mockCodexCliJsonl.ts';
import type { BirdCoderCodingSessionRuntime } from '../packages/sdkwork-birdcoder-types/src/index.ts';

const messages: ChatMessage[] = [
  {
    id: 'msg-user-provider-1',
    role: 'user',
    content: 'Inspect the repository and apply the required changes.',
    timestamp: Date.now(),
  },
];

const fakeCodexJsonlLines = [
  `${JSON.stringify({
    type: 'item.updated',
    item: {
      id: 'coding-server-provider-message',
      type: 'agent_message',
      text: 'Codex provider projection response.',
    },
  })}\n`,
  `${JSON.stringify({
    type: 'item.completed',
    item: {
      id: 'coding-server-provider-command',
      type: 'command_execution',
      command: 'pnpm lint',
      aggregated_output: 'ok',
      exit_code: 0,
      status: 'completed',
    },
  })}\n`,
  `${JSON.stringify({
    type: 'turn.completed',
  })}\n`,
];

function normalizeRuntimeRecord(value: unknown): BirdCoderCodingSessionRuntime | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('id' in value) ||
    typeof value.id !== 'string'
  ) {
    return null;
  }

  return value as BirdCoderCodingSessionRuntime;
}

await withMockCodexCliJsonl(async () => {
  const sqliteProvider = createBirdCoderStorageProvider('sqlite');
  await sqliteProvider.open();
  await sqliteProvider.runMigrations([getBirdCoderSchemaMigrationDefinition('coding-server-kernel-v2')]);

  assert.equal(sqliteProvider.providerId, 'sqlite');
  assert.equal(sqliteProvider.dialect.providerId, 'sqlite');
  assert.equal((await sqliteProvider.healthCheck()).status, 'healthy');

  const stagedProjection = await executeBirdCoderCoreSessionRun({
    sessionId: 'coding-session-provider-uow',
    runtimeId: 'runtime-provider-uow-1',
    turnId: 'turn-provider-uow-1',
    engineId: 'codex',
    modelId: 'codex',
    hostMode: 'server',
    messages,
    options: {
      model: 'codex',
    },
  });

  const providerRuntimeRepository = createBirdCoderTableRecordRepository({
    binding: BIRDCODER_CODING_SESSION_RUNTIME_STORAGE_BINDING,
    definition: getBirdCoderEntityDefinition('coding_session_runtime'),
    identify(value) {
      return value.id;
    },
    normalize: normalizeRuntimeRecord,
    providerId: sqliteProvider.providerId,
    storage: sqliteProvider,
  });

  await providerRuntimeRepository.clear();

  const rollbackUnitOfWork = await sqliteProvider.beginUnitOfWork();
  const stagedRuntimeRepository = createBirdCoderTableRecordRepository({
    binding: BIRDCODER_CODING_SESSION_RUNTIME_STORAGE_BINDING,
    definition: getBirdCoderEntityDefinition('coding_session_runtime'),
    identify(value) {
      return value.id;
    },
    normalize: normalizeRuntimeRecord,
    providerId: sqliteProvider.providerId,
    storage: rollbackUnitOfWork,
  });

  await stagedRuntimeRepository.save(stagedProjection.runtime);
  assert.equal(
    (await stagedRuntimeRepository.findById(stagedProjection.runtime.id))?.id,
    stagedProjection.runtime.id,
  );
  assert.equal(await providerRuntimeRepository.findById(stagedProjection.runtime.id), null);

  await rollbackUnitOfWork.rollback();
  assert.equal(await providerRuntimeRepository.findById(stagedProjection.runtime.id), null);

  const commitUnitOfWork = await sqliteProvider.beginUnitOfWork();
  const committedRuntimeRepository = createBirdCoderTableRecordRepository({
    binding: BIRDCODER_CODING_SESSION_RUNTIME_STORAGE_BINDING,
    definition: getBirdCoderEntityDefinition('coding_session_runtime'),
    identify(value) {
      return value.id;
    },
    normalize: normalizeRuntimeRecord,
    providerId: sqliteProvider.providerId,
    storage: commitUnitOfWork,
  });

  await committedRuntimeRepository.save(stagedProjection.runtime);
  await commitUnitOfWork.commit();
  assert.equal(
    (await providerRuntimeRepository.findById(stagedProjection.runtime.id))?.id,
    stagedProjection.runtime.id,
  );

  const sqliteStore = createProviderBackedBirdCoderCoreSessionProjectionStore(
    'coding-session-provider-1',
    sqliteProvider,
  );

  assert.equal(sqliteStore.providerId, 'sqlite');
  assert.equal(sqliteStore.bindings.runtime.entityName, 'coding_session_runtime');
  assert.equal(sqliteStore.bindings.events.entityName, 'coding_session_event');
  assert.equal(sqliteStore.bindings.artifacts.entityName, 'coding_session_artifact');
  assert.equal(sqliteStore.bindings.operations.entityName, 'coding_session_operation');

  const sqliteProjection = await executeBirdCoderCoreSessionRun({
    sessionId: 'coding-session-provider-1',
    runtimeId: 'runtime-provider-sqlite-1',
    turnId: 'turn-provider-sqlite-1',
    engineId: 'codex',
    modelId: 'codex',
    hostMode: 'server',
    messages,
    options: {
      model: 'codex',
    },
  });

  await persistBirdCoderCoreSessionRunProjection(sqliteStore, sqliteProjection);

  const sqliteReloadedStore = createProviderBackedBirdCoderCoreSessionProjectionStore(
    'coding-session-provider-1',
    sqliteProvider,
  );
  const sqliteSnapshot = await sqliteReloadedStore.getSessionSnapshot('coding-session-provider-1');

  assert.equal(sqliteSnapshot.runtime?.id, 'runtime-provider-sqlite-1');
  assert.equal(sqliteSnapshot.runtime?.modelId, 'codex');
  assert.equal(sqliteSnapshot.runtime?.nativeRef.transportKind, 'cli-jsonl');
  assert.equal(sqliteSnapshot.runtime?.nativeRef.nativeSessionId, 'coding-session-provider-1');
  assert.deepEqual(sqliteSnapshot.runtime?.capabilitySnapshot, sqliteProjection.runtime.capabilitySnapshot);
  assert.equal(sqliteSnapshot.events.length, sqliteProjection.events.length);
  assert.deepEqual(
    sqliteSnapshot.events.map((event) => event.kind),
    sqliteProjection.events.map((event) => event.kind),
  );
  assert.equal(sqliteSnapshot.events.some((event) => event.kind === 'approval.required'), true);
  assert.equal(sqliteSnapshot.artifacts.length, sqliteProjection.artifacts.length);
  assert.deepEqual(
    sqliteSnapshot.artifacts.map((artifact) => artifact.kind),
    sqliteProjection.artifacts.map((artifact) => artifact.kind),
  );
  assert.deepEqual(
    sqliteSnapshot.operations.map((operation) => operation.operationId),
    ['turn-provider-sqlite-1:operation'],
  );

  const postgresStore = createProviderBackedBirdCoderCoreSessionProjectionStore(
    'coding-session-provider-1',
    'postgresql',
  );
  const initialPostgresSnapshot = await postgresStore.getSessionSnapshot('coding-session-provider-1');

  assert.equal(initialPostgresSnapshot.runtime, null);
  assert.equal(initialPostgresSnapshot.events.length, 0);
  assert.equal(initialPostgresSnapshot.artifacts.length, 0);
  assert.equal(initialPostgresSnapshot.operations.length, 0);

  const postgresProjection = await executeBirdCoderCoreSessionRun({
    sessionId: 'coding-session-provider-1',
    runtimeId: 'runtime-provider-postgres-1',
    turnId: 'turn-provider-postgres-1',
    engineId: 'codex',
    modelId: 'codex',
    hostMode: 'server',
    messages,
    options: {
      model: 'codex',
    },
  });

  await persistBirdCoderCoreSessionRunProjection(postgresStore, postgresProjection);

  const postgresReloadedStore = createProviderBackedBirdCoderCoreSessionProjectionStore(
    'coding-session-provider-1',
    'postgresql',
  );
  const postgresSnapshot = await postgresReloadedStore.getSessionSnapshot('coding-session-provider-1');

  assert.equal(postgresSnapshot.runtime?.id, 'runtime-provider-postgres-1');
  assert.equal(postgresSnapshot.runtime?.modelId, 'codex');
  assert.equal(postgresSnapshot.events.length, postgresProjection.events.length);
  assert.equal(postgresSnapshot.artifacts.length, postgresProjection.artifacts.length);
  assert.deepEqual(
    postgresSnapshot.operations.map((operation) => operation.operationId),
    ['turn-provider-postgres-1:operation'],
  );

  const sqliteSnapshotAfterPostgres =
    await sqliteReloadedStore.getSessionSnapshot('coding-session-provider-1');

  assert.equal(sqliteSnapshotAfterPostgres.runtime?.id, 'runtime-provider-sqlite-1');
  assert.equal(sqliteSnapshotAfterPostgres.events.length, sqliteProjection.events.length);
  assert.deepEqual(
    sqliteSnapshotAfterPostgres.operations.map((operation) => operation.operationId),
    ['turn-provider-sqlite-1:operation'],
  );
}, {
  stdoutLines: fakeCodexJsonlLines,
});

console.log('coding server provider projection repository contract passed.');
