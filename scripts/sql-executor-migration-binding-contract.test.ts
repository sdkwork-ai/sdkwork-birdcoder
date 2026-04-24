import assert from 'node:assert/strict';

const dataKernelModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts',
  import.meta.url,
);
const providersModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts',
  import.meta.url,
);
const sqlExecutorModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/sqlExecutor.ts',
  import.meta.url,
);

const dataKernelModule = await import(`${dataKernelModulePath.href}?t=${Date.now()}`);
const providersModule = await import(`${providersModulePath.href}?t=${Date.now()}`);
const sqlExecutorModule = await import(`${sqlExecutorModulePath.href}?t=${Date.now()}`);

assert.equal(typeof sqlExecutorModule.createBirdCoderRecordingSqlExecutor, 'function');

const codingServerKernelMigration =
  providersModule.getBirdCoderSchemaMigrationDefinition('coding-server-kernel-v2');

assert.deepEqual(
  codingServerKernelMigration.entityNames.includes('coding_session_prompt_entry'),
  true,
  'coding server kernel migration must include coding_session_prompt_entry',
);
assert.deepEqual(
  codingServerKernelMigration.entityNames.includes('saved_prompt_entry'),
  true,
  'coding server kernel migration must include saved_prompt_entry',
);

const sqliteExecutor = sqlExecutorModule.createBirdCoderRecordingSqlExecutor('sqlite');
const sqliteProvider = dataKernelModule.createBirdCoderStorageProvider('sqlite', {
  sqlExecutor: sqliteExecutor,
});

await sqliteProvider.open();
await sqliteProvider.runMigrations([
  providersModule.getBirdCoderSchemaMigrationDefinition('runtime-data-kernel-v1'),
  providersModule.getBirdCoderSchemaMigrationDefinition('coding-server-kernel-v2'),
]);

assert.equal(sqliteExecutor.history.length, 3);
assert.equal(sqliteExecutor.history[0].intent, 'write');
assert.equal(
  sqliteExecutor.history[0].statements.some((statement) =>
    statement.sql.includes('CREATE TABLE IF NOT EXISTS terminal_executions'),
  ),
  true,
);
assert.equal(
  sqliteExecutor.history[0].statements.some((statement) =>
    statement.sql.includes('CREATE TABLE IF NOT EXISTS coding_session_prompt_entries'),
  ),
  true,
);
assert.equal(
  sqliteExecutor.history[0].statements.some((statement) =>
    statement.sql.includes('CREATE TABLE IF NOT EXISTS saved_prompt_entries'),
  ),
  true,
);
assert.equal(
  sqliteExecutor.history[1].statements[0].sql.includes('INSERT INTO schema_migration_history'),
  true,
);
assert.equal(
  sqliteExecutor.history[2].statements[0].sql.includes('INSERT INTO schema_migration_history'),
  true,
);

await sqliteProvider.runMigrations([
  providersModule.getBirdCoderSchemaMigrationDefinition('runtime-data-kernel-v1'),
  providersModule.getBirdCoderSchemaMigrationDefinition('coding-server-kernel-v2'),
]);
assert.equal(sqliteExecutor.history.length, 3, 'applied migrations should stay replay-safe');

const postgresExecutor = sqlExecutorModule.createBirdCoderRecordingSqlExecutor('postgresql');
const postgresProvider = dataKernelModule.createBirdCoderStorageProvider('postgresql', {
  sqlExecutor: postgresExecutor,
});

await postgresProvider.open();
await postgresProvider.runMigrations([
  providersModule.getBirdCoderSchemaMigrationDefinition('coding-server-kernel-v2'),
]);

assert.equal(postgresExecutor.history.length, 3);
assert.equal(postgresExecutor.history[0].providerId, 'postgresql');
assert.equal(
  postgresExecutor.history[0].statements.some((statement) =>
    statement.sql.includes('CREATE TABLE IF NOT EXISTS terminal_executions') ||
    statement.sql.includes('CREATE TABLE IF NOT EXISTS coding_sessions') ||
    statement.sql.includes('CREATE TABLE IF NOT EXISTS saved_prompt_entries'),
  ),
  true,
);
assert.match(
  postgresExecutor.history[1].statements[0].sql,
  /ON CONFLICT\(provider_id, migration_id\) DO NOTHING;/,
);
assert.match(
  postgresExecutor.history[2].statements[0].sql,
  /ON CONFLICT\(provider_id, migration_id\) DO NOTHING;/,
);

console.log('sql executor migration binding contract passed.');
