import assert from 'node:assert/strict';

import type { ChatMessage } from '../packages/sdkwork-birdcoder-chat/src/types.ts';
import { createBirdCoderStorageProvider } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts';
import { getBirdCoderSchemaMigrationDefinition } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts';
import { createBirdCoderInMemorySqlExecutor } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/sqlExecutor.ts';
import {
  createProviderBackedBirdCoderCoreSessionProjectionStore,
  executeBirdCoderCoreSessionRun,
  persistBirdCoderCoreSessionRunProjection,
} from '../packages/sdkwork-birdcoder-server/src/index.ts';

const messages: ChatMessage[] = [
  {
    id: 'msg-user-sql-executor-1',
    role: 'user',
    content: 'Use the SQL executor-backed projection store.',
    timestamp: Date.now(),
  },
];

const sqlExecutor = createBirdCoderInMemorySqlExecutor('sqlite');
const provider = createBirdCoderStorageProvider('sqlite', {
  sqlExecutor,
});

await provider.open();
await provider.runMigrations([getBirdCoderSchemaMigrationDefinition('coding-server-kernel-v2')]);

const projectionStore = createProviderBackedBirdCoderCoreSessionProjectionStore(
  'coding-session-sql-executor',
  provider,
);

const projection = await executeBirdCoderCoreSessionRun({
  sessionId: 'coding-session-sql-executor',
  runtimeId: 'runtime-sql-executor-projection',
  turnId: 'turn-sql-executor-projection',
  engineId: 'codex',
  modelId: 'codex',
  hostMode: 'server',
  messages,
  options: {
    model: 'codex',
  },
});

await persistBirdCoderCoreSessionRunProjection(projectionStore, projection);

const snapshot = await projectionStore.getSessionSnapshot('coding-session-sql-executor');

assert.equal(snapshot.runtime?.id, 'runtime-sql-executor-projection');
assert.equal(snapshot.events.length, projection.events.length);
assert.equal(snapshot.artifacts.length, projection.artifacts.length);
assert.deepEqual(
  snapshot.operations.map((operation) => operation.operationId),
  ['turn-sql-executor-projection:operation'],
);

assert.equal(
  sqlExecutor.history.some((plan) => plan.meta?.kind === 'table-upsert'),
  true,
  'projection persistence should emit table upsert plans through the executor',
);
assert.equal(
  sqlExecutor.history.some((plan) => plan.meta?.kind === 'table-list'),
  true,
  'projection reads should emit table list plans through the executor',
);

console.log('sql executor projection repository contract passed.');
