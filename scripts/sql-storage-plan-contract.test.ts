import assert from 'node:assert/strict';

const typesModulePath = new URL('../packages/sdkwork-birdcoder-types/src/index.ts', import.meta.url);
const providersModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts',
  import.meta.url,
);
const sqlPlansModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/sqlPlans.ts',
  import.meta.url,
);

const typesModule = await import(`${typesModulePath.href}?t=${Date.now()}`);
const providersModule = await import(`${providersModulePath.href}?t=${Date.now()}`);
const sqlPlansModule = await import(`${sqlPlansModulePath.href}?t=${Date.now()}`);

assert.equal(typeof sqlPlansModule.buildBirdCoderSchemaMigrationPlan, 'function');
assert.equal(typeof sqlPlansModule.buildBirdCoderSchemaMigrationHistoryUpsertPlan, 'function');
assert.equal(typeof sqlPlansModule.combineBirdCoderSqlPlans, 'function');
assert.equal(typeof sqlPlansModule.createBirdCoderTableSqlPlanner, 'function');

const runtimeDefinition = typesModule.getBirdCoderEntityDefinition('coding_session_runtime');
const runtimeBinding = typesModule.BIRDCODER_CODING_SESSION_RUNTIME_STORAGE_BINDING;

const sqlitePlanner = sqlPlansModule.createBirdCoderTableSqlPlanner({
  binding: runtimeBinding,
  definition: runtimeDefinition,
  providerId: 'sqlite',
});

const sqliteListPlan = sqlitePlanner.buildListPlan();
assert.equal(sqliteListPlan.providerId, 'sqlite');
assert.equal(sqliteListPlan.intent, 'read');
assert.equal(sqliteListPlan.statements.length, 1);
assert.equal(
  sqliteListPlan.statements[0].sql,
  'SELECT * FROM coding_session_runtimes WHERE is_deleted = ?1 ORDER BY updated_at DESC, id ASC;',
);
assert.deepEqual(sqliteListPlan.statements[0].params, [0]);

const sqliteCountPlan = sqlitePlanner.buildCountPlan();
assert.equal(
  sqliteCountPlan.statements[0].sql,
  'SELECT COUNT(*) AS total FROM coding_session_runtimes WHERE is_deleted = ?1;',
);
assert.deepEqual(sqliteCountPlan.statements[0].params, [0]);

const sqliteFindByIdPlan = sqlitePlanner.buildFindByIdPlan('runtime-sqlite-1');
assert.equal(
  sqliteFindByIdPlan.statements[0].sql,
  'SELECT * FROM coding_session_runtimes WHERE id = ?1 AND is_deleted = ?2 LIMIT 1;',
);
assert.deepEqual(sqliteFindByIdPlan.statements[0].params, ['runtime-sqlite-1', 0]);

const sqliteUpsertPlan = sqlitePlanner.buildUpsertPlan([
  {
    id: 'runtime-sqlite-1',
    created_at: '2026-04-10T12:00:00.000Z',
    updated_at: '2026-04-10T12:00:00.000Z',
    version: 0,
    is_deleted: 0,
    coding_session_id: 'coding-session-1',
    engine_id: 'codex',
    model_id: 'codex',
    host_mode: 'server',
    status: 'ready',
    transport_kind: 'cli',
    native_session_id: 'native-session-1',
    native_turn_container_id: 'turn-1',
    capability_snapshot_json: '{"toolCalls":true}',
    metadata_json: '{}',
  },
]);
assert.equal(sqliteUpsertPlan.intent, 'write');
assert.equal(sqliteUpsertPlan.transactional, true);
assert.equal(sqliteUpsertPlan.statements.length, 1);
assert.match(
  sqliteUpsertPlan.statements[0].sql,
  /^INSERT INTO coding_session_runtimes \(.+\) VALUES \(.+\) ON CONFLICT\(id\) DO UPDATE SET .+;$/,
);
assert.match(sqliteUpsertPlan.statements[0].sql, /\?15\)/);
assert.match(sqliteUpsertPlan.statements[0].sql, /coding_session_id = excluded\.coding_session_id/);
assert.equal(sqliteUpsertPlan.statements[0].params.length, 15);

const sqliteDeletePlan = sqlitePlanner.buildDeletePlan('runtime-sqlite-1');
assert.equal(
  sqliteDeletePlan.statements[0].sql,
  'DELETE FROM coding_session_runtimes WHERE id = ?1;',
);
assert.deepEqual(sqliteDeletePlan.statements[0].params, ['runtime-sqlite-1']);

const sqliteClearPlan = sqlitePlanner.buildClearPlan();
assert.equal(sqliteClearPlan.statements[0].sql, 'DELETE FROM coding_session_runtimes;');
assert.deepEqual(sqliteClearPlan.statements[0].params, []);

const postgresPlanner = sqlPlansModule.createBirdCoderTableSqlPlanner({
  binding: runtimeBinding,
  definition: runtimeDefinition,
  providerId: 'postgresql',
});

const postgresListPlan = postgresPlanner.buildListPlan();
assert.equal(
  postgresListPlan.statements[0].sql,
  'SELECT * FROM coding_session_runtimes WHERE is_deleted = $1 ORDER BY updated_at DESC, id ASC;',
);
assert.deepEqual(postgresListPlan.statements[0].params, [false]);

const postgresUpsertPlan = postgresPlanner.buildUpsertPlan([
  {
    id: 'runtime-postgres-1',
    created_at: '2026-04-10T12:00:00.000Z',
    updated_at: '2026-04-10T12:00:00.000Z',
    version: 0,
    is_deleted: false,
    coding_session_id: 'coding-session-1',
    engine_id: 'codex',
    model_id: 'codex',
    host_mode: 'server',
    status: 'ready',
    transport_kind: 'cli',
    native_session_id: 'native-session-1',
    native_turn_container_id: 'turn-1',
    capability_snapshot_json: { toolCalls: true },
    metadata_json: {},
  },
]);
assert.match(postgresUpsertPlan.statements[0].sql, /\$15\)/);
assert.match(postgresUpsertPlan.statements[0].sql, /ON CONFLICT\(id\) DO UPDATE SET/);
assert.deepEqual(postgresUpsertPlan.statements[0].params.slice(0, 5), [
  'runtime-postgres-1',
  '2026-04-10T12:00:00.000Z',
  '2026-04-10T12:00:00.000Z',
  0,
  false,
]);

const migrationPlan = sqlPlansModule.buildBirdCoderSchemaMigrationPlan('sqlite', [
  providersModule.getBirdCoderSchemaMigrationDefinition('coding-server-kernel-v2'),
]);
assert.equal(migrationPlan.intent, 'write');
assert.equal(migrationPlan.transactional, true);
assert.equal(
  migrationPlan.statements.some((statement) =>
    statement.sql.includes('CREATE TABLE IF NOT EXISTS coding_session_runtimes'),
  ),
  true,
);

const migrationHistoryPlan = sqlPlansModule.buildBirdCoderSchemaMigrationHistoryUpsertPlan(
  'postgresql',
  {
    appliedAt: '2026-04-10T12:00:00.000Z',
    description: 'Bootstrap coding server kernel.',
    entityNames: ['coding_session_runtime', 'coding_session_event'],
    migrationId: 'coding-server-kernel-v2',
    providerId: 'postgresql',
  },
);
assert.equal(migrationHistoryPlan.intent, 'write');
assert.equal(migrationHistoryPlan.statements.length, 1);
assert.match(
  migrationHistoryPlan.statements[0].sql,
  /INSERT INTO schema_migration_history \(.+\) VALUES \(.+\) ON CONFLICT\(provider_id, migration_id\) DO NOTHING;$/,
);
assert.deepEqual(migrationHistoryPlan.statements[0].params.slice(0, 5), [
  'postgresql:coding-server-kernel-v2',
  '2026-04-10T12:00:00.000Z',
  '2026-04-10T12:00:00.000Z',
  0,
  false,
]);

const bundledPlan = sqlPlansModule.combineBirdCoderSqlPlans(sqliteDeletePlan, sqliteClearPlan);
assert.equal(bundledPlan.providerId, 'sqlite');
assert.equal(bundledPlan.intent, 'write');
assert.equal(bundledPlan.transactional, true);
assert.equal(bundledPlan.statements.length, 2);

console.log('sql storage plan contract passed.');
