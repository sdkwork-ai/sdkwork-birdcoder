import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { ChatMessage } from '../packages/sdkwork-birdcoder-chat/src/types.ts';
import { createBirdCoderStorageProvider } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts';
import { getBirdCoderSchemaMigrationDefinition } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts';
import { createBirdCoderSqliteFileSqlExecutor } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/sqlBackendExecutors.ts';
import {
  executeBirdCoderCoreSessionRun,
  persistBirdCoderCoreSessionRunProjection,
} from '../packages/sdkwork-birdcoder-server/src/index.ts';
import { createProviderBackedBirdCoderCoreSessionProjectionStore } from '../packages/sdkwork-birdcoder-server/src/projectionRepository.ts';
import { withMockCodexCliJsonl } from './test-support/mockCodexCliJsonl.ts';

const tempDirectory = await fs.mkdtemp(
  path.join(os.tmpdir(), `birdcoder-sqlite-executor-${process.pid}-`),
);
const databaseFile = path.join(tempDirectory, 'authority.sqlite3');

const messages: ChatMessage[] = [
  {
    id: 'msg-user-sqlite-backend-1',
    role: 'user',
    content: 'Persist this coding session through the real sqlite executor.',
    timestamp: Date.now(),
  },
];

let provider:
  | ReturnType<typeof createBirdCoderStorageProvider>
  | null = null;
let reloadedProvider:
  | ReturnType<typeof createBirdCoderStorageProvider>
  | null = null;

try {
  const sqlExecutor = createBirdCoderSqliteFileSqlExecutor({
    databaseFile,
  });
  provider = createBirdCoderStorageProvider('sqlite', {
    sqlExecutor,
  });

  await provider.open();
  await provider.runMigrations([getBirdCoderSchemaMigrationDefinition('coding-server-kernel-v2')]);

  const projectionStore = createProviderBackedBirdCoderCoreSessionProjectionStore(
    'coding-session-sqlite-file',
    provider,
  );
  const projection = await withMockCodexCliJsonl(() =>
    executeBirdCoderCoreSessionRun({
      sessionId: 'coding-session-sqlite-file',
      runtimeId: 'runtime-sqlite-file-1',
      turnId: 'turn-sqlite-file-1',
      engineId: 'codex',
      modelId: 'codex',
      hostMode: 'server',
      messages,
      options: {
        model: 'codex',
      },
    }),
  );

  await persistBirdCoderCoreSessionRunProjection(projectionStore, projection);
  await provider.close();

  reloadedProvider = createBirdCoderStorageProvider('sqlite', {
    sqlExecutor: createBirdCoderSqliteFileSqlExecutor({
      databaseFile,
    }),
  });
  const reloadedStore = createProviderBackedBirdCoderCoreSessionProjectionStore(
    'coding-session-sqlite-file',
    reloadedProvider,
  );
  const snapshot = await reloadedStore.getSessionSnapshot('coding-session-sqlite-file');

  assert.equal(snapshot.runtime?.id, projection.runtime.id);
  assert.equal(snapshot.runtime?.codingSessionId, projection.runtime.codingSessionId);
  assert.equal(snapshot.runtime?.hostMode, projection.runtime.hostMode);
  assert.equal(snapshot.runtime?.nativeRef.transportKind, projection.runtime.nativeRef.transportKind);
  assert.deepEqual(snapshot.runtime?.capabilitySnapshot, projection.runtime.capabilitySnapshot);
  assert.deepEqual(snapshot.runtime?.metadata, projection.runtime.metadata);

  const snapshotEvents = [...snapshot.events].sort((left, right) => left.sequence - right.sequence);
  const projectionEvents = [...projection.events].sort((left, right) => left.sequence - right.sequence);
  assert.equal(snapshot.events.length, projection.events.length);
  assert.deepEqual(
    snapshotEvents.map((event) => ({
      id: event.id,
      kind: event.kind,
      sequence: event.sequence,
      payload: event.payload,
    })),
    projectionEvents.map((event) => ({
      id: event.id,
      kind: event.kind,
      sequence: event.sequence,
      payload: event.payload,
    })),
  );

  const snapshotArtifacts = [...snapshot.artifacts].sort((left, right) => left.id.localeCompare(right.id));
  const projectionArtifacts = [...projection.artifacts].sort((left, right) => left.id.localeCompare(right.id));
  assert.equal(snapshot.artifacts.length, projection.artifacts.length);
  assert.deepEqual(
    snapshotArtifacts.map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      title: artifact.title,
      metadata: artifact.metadata,
    })),
    projectionArtifacts.map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      title: artifact.title,
      metadata: artifact.metadata,
    })),
  );

  assert.deepEqual(
    snapshot.operations.map((operation) => ({
      operationId: operation.operationId,
      status: operation.status,
      artifactRefs: operation.artifactRefs,
      streamKind: operation.streamKind,
      streamUrl: operation.streamUrl,
    })),
    [
      {
        operationId: projection.operation.operationId,
        status: projection.operation.status,
        artifactRefs: projection.operation.artifactRefs,
        streamKind: projection.operation.streamKind,
        streamUrl: projection.operation.streamUrl,
      },
    ],
  );

} finally {
  await reloadedProvider?.close().catch(() => undefined);
  await provider?.close().catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 50));
  await fs.rm(tempDirectory, { force: true, recursive: true }).catch(() => undefined);
}

console.log('sqlite file sql executor contract passed.');
