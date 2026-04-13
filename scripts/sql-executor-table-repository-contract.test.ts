import assert from 'node:assert/strict';

const dataKernelModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts',
  import.meta.url,
);
const sqlExecutorModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/sqlExecutor.ts',
  import.meta.url,
);
const providersModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts',
  import.meta.url,
);
const typesModulePath = new URL('../packages/sdkwork-birdcoder-types/src/index.ts', import.meta.url);

const dataKernelModule = await import(`${dataKernelModulePath.href}?t=${Date.now()}`);
const sqlExecutorModule = await import(`${sqlExecutorModulePath.href}?t=${Date.now()}`);
const providersModule = await import(`${providersModulePath.href}?t=${Date.now()}`);
const typesModule = await import(`${typesModulePath.href}?t=${Date.now()}`);

assert.equal(typeof sqlExecutorModule.createBirdCoderInMemorySqlExecutor, 'function');

function runtimeToRow(value) {
  return {
    id: value.id,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    version: 0,
    is_deleted: false,
    coding_session_id: value.codingSessionId,
    engine_id: value.engineId,
    model_id: value.modelId ?? null,
    host_mode: value.hostMode,
    status: value.status,
    transport_kind: value.nativeRef.transportKind,
    native_session_id: value.nativeRef.nativeSessionId ?? null,
    native_turn_container_id: value.nativeRef.nativeTurnContainerId ?? null,
    capability_snapshot_json: value.capabilitySnapshot,
    metadata_json: value.metadata ?? {},
  };
}

function runtimeFromRow(row) {
  if (!row || typeof row !== 'object' || typeof row.id !== 'string') {
    return null;
  }

  return {
    id: row.id,
    codingSessionId: row.coding_session_id,
    hostMode: row.host_mode,
    status: row.status,
    engineId: row.engine_id,
    modelId: row.model_id ?? undefined,
    nativeRef: {
      engineId: row.engine_id,
      transportKind: row.transport_kind,
      nativeSessionId: row.native_session_id ?? undefined,
      nativeTurnContainerId: row.native_turn_container_id ?? undefined,
      metadata: row.metadata_json ?? {},
    },
    capabilitySnapshot: row.capability_snapshot_json ?? {},
    metadata: row.metadata_json ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const runtime = {
  id: 'runtime-sql-executor-1',
  codingSessionId: 'coding-session-sql-executor-1',
  hostMode: 'server',
  status: 'ready',
  engineId: 'codex',
  modelId: 'codex',
  nativeRef: {
    engineId: 'codex',
    transportKind: 'cli',
    nativeSessionId: 'native-runtime-1',
    nativeTurnContainerId: 'turn-1',
    metadata: {},
  },
  capabilitySnapshot: {
    toolCalls: true,
  },
  metadata: {},
  createdAt: '2026-04-10T15:00:00.000Z',
  updatedAt: '2026-04-10T15:00:00.000Z',
};

const sqlExecutor = sqlExecutorModule.createBirdCoderInMemorySqlExecutor('sqlite');
const provider = dataKernelModule.createBirdCoderStorageProvider('sqlite', {
  sqlExecutor,
});

await provider.open();
await provider.runMigrations([
  providersModule.getBirdCoderSchemaMigrationDefinition('coding-server-kernel-v2'),
]);

const providerRepository = dataKernelModule.createBirdCoderTableRecordRepository({
  binding: typesModule.BIRDCODER_CODING_SESSION_RUNTIME_STORAGE_BINDING,
  definition: typesModule.getBirdCoderEntityDefinition('coding_session_runtime'),
  identify(value) {
    return value.id;
  },
  normalize(value) {
    return runtimeFromRow(value);
  },
  providerId: 'sqlite',
  storage: provider,
  toRow: runtimeToRow,
});

await providerRepository.clear();
assert.equal(await providerRepository.count(), 0);
assert.equal(await providerRepository.findById(runtime.id), null);

const unitOfWork = await provider.beginUnitOfWork();
const unitOfWorkRepository = dataKernelModule.createBirdCoderTableRecordRepository({
  binding: typesModule.BIRDCODER_CODING_SESSION_RUNTIME_STORAGE_BINDING,
  definition: typesModule.getBirdCoderEntityDefinition('coding_session_runtime'),
  identify(value) {
    return value.id;
  },
  normalize(value) {
    return runtimeFromRow(value);
  },
  providerId: 'sqlite',
  storage: unitOfWork,
  toRow: runtimeToRow,
});

await unitOfWorkRepository.save(runtime);
assert.equal((await unitOfWorkRepository.findById(runtime.id))?.id, runtime.id);
assert.equal(await unitOfWorkRepository.count(), 1);
assert.equal(await providerRepository.findById(runtime.id), null);

await unitOfWork.commit();

assert.equal((await providerRepository.findById(runtime.id))?.id, runtime.id);
assert.equal((await providerRepository.list())[0]?.id, runtime.id);
assert.equal(await providerRepository.count(), 1);

await providerRepository.clear();
assert.equal(await providerRepository.count(), 0);
assert.equal(await providerRepository.findById(runtime.id), null);

console.log('sql executor table repository contract passed.');
