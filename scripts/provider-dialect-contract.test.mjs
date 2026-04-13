import assert from 'node:assert/strict';

const providersModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts',
  import.meta.url,
);

const providersModule = await import(`${providersModulePath.href}?t=${Date.now()}`);

assert.equal(typeof providersModule.createBirdCoderStorageDialect, 'function');
assert.equal(typeof providersModule.getBirdCoderSchemaMigrationDefinition, 'function');

const sqliteDialect = providersModule.createBirdCoderStorageDialect('sqlite');
assert.equal(sqliteDialect.providerId, 'sqlite');
assert.equal(sqliteDialect.buildPlaceholder(2), '?2');
assert.equal(sqliteDialect.mapLogicalType('json'), 'TEXT');
assert.equal(sqliteDialect.mapLogicalType('timestamp'), 'TEXT');

const postgresDialect = providersModule.createBirdCoderStorageDialect('postgresql');
assert.equal(postgresDialect.providerId, 'postgresql');
assert.equal(postgresDialect.buildPlaceholder(2), '$2');
assert.equal(postgresDialect.mapLogicalType('json'), 'JSONB');
assert.equal(postgresDialect.mapLogicalType('timestamp'), 'TIMESTAMPTZ');

const runtimeMigration = providersModule.getBirdCoderSchemaMigrationDefinition('runtime-data-kernel-v1');
assert.ok(runtimeMigration.sqlByProvider.sqlite?.some((statement) => statement.includes('terminal_executions')));
assert.ok(runtimeMigration.sqlByProvider.postgresql?.some((statement) => statement.includes('terminal_executions')));

const codingServerMigration = providersModule.getBirdCoderSchemaMigrationDefinition('coding-server-kernel-v2');
assert.ok(codingServerMigration.sqlByProvider.sqlite?.some((statement) => statement.includes('coding_sessions')));
assert.ok(codingServerMigration.sqlByProvider.postgresql?.some((statement) => statement.includes('deployment_records')));

console.log('provider dialect contract passed.');
