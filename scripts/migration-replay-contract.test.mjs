import assert from 'node:assert/strict';

const dataModulePath = new URL('../packages/sdkwork-birdcoder-types/src/data.ts', import.meta.url);
const providersModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts',
  import.meta.url,
);

const dataModule = await import(`${dataModulePath.href}?t=${Date.now()}`);
const providersModule = await import(`${providersModulePath.href}?t=${Date.now()}`);

const migrations = providersModule.BIRDCODER_SCHEMA_MIGRATIONS;
const migrationIds = migrations.map((migration) => migration.migrationId);

assert.deepEqual(migrationIds, ['runtime-data-kernel-v1', 'coding-server-kernel-v2']);
assert.equal(new Set(migrationIds).size, migrationIds.length, 'Migration ids must stay unique');

for (const providerId of ['sqlite', 'postgresql']) {
  for (const migration of migrations) {
    const statements = migration.sqlByProvider[providerId];

    assert.equal(
      Array.isArray(statements) && statements.length > 0,
      true,
      `${migration.migrationId} must provide ${providerId} statements`,
    );

    for (const statement of statements) {
      assert.match(
        statement,
        /IF NOT EXISTS/i,
        `${migration.migrationId} must stay replay-safe for ${providerId}`,
      );
    }

    for (const entityName of migration.entityNames) {
      const definition = dataModule.getBirdCoderEntityDefinition(entityName);
      assert.equal(
        statements.some((statement) => statement.includes(definition.tableName)),
        true,
        `${migration.migrationId} must materialize ${definition.tableName} for ${providerId}`,
      );
    }
  }
}

console.log('migration replay contract passed.');
