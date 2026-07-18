import assert from 'node:assert/strict';
import fs from 'node:fs';

const dataModulePath = new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/data.ts', import.meta.url);
const providersModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/providers.ts',
  import.meta.url,
);

const DATABASE_ENGINES = [
  {
    id: 'sqlite',
    baselineDirectory: new URL('../database/ddl/baseline/sqlite/', import.meta.url),
    baselineFile: new URL('../database/ddl/baseline/sqlite/0001_birdcoder_baseline.sql', import.meta.url),
    generatedFile: new URL('../database/ddl/generated/sqlite_schema.sql', import.meta.url),
    migrationDirectory: new URL('../database/migrations/sqlite/', import.meta.url),
    providerId: 'sqlite',
  },
  {
    id: 'postgres',
    baselineDirectory: new URL('../database/ddl/baseline/postgres/', import.meta.url),
    baselineFile: new URL('../database/ddl/baseline/postgres/0001_birdcoder_baseline.sql', import.meta.url),
    generatedFile: new URL('../database/ddl/generated/postgres_schema.sql', import.meta.url),
    migrationDirectory: new URL('../database/migrations/postgres/', import.meta.url),
    providerId: 'postgresql',
  },
];

function getSqlFileNames(directoryUrl) {
  return fs
    .readdirSync(directoryUrl, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();
}

function extractCreateTableBody(sql, tableName) {
  const tablePattern = new RegExp(
    `CREATE TABLE IF NOT EXISTS ${tableName} \\((?<body>[\\s\\S]*?)\\r?\\n\\);`,
    'i',
  );
  const match = sql.match(tablePattern);

  assert.ok(match?.groups?.body, `${tableName} must be declared exactly once`);
  return match.groups.body;
}

function countCreateTableDeclarations(sql, tableName) {
  return [...sql.matchAll(new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName} \\(`, 'gi'))].length;
}

function assertLegacyRuntimeLocationColumn(sql, sourceLabel) {
  const codingSessionTable = extractCreateTableBody(sql, 'ai_coding_session');
  const runtimeLocationColumns = [
    ...codingSessionTable.matchAll(/^\s*runtime_location_id\s+TEXT\s+NULL,?\s*$/gim),
  ];

  assert.equal(
    runtimeLocationColumns.length,
    1,
    `${sourceLabel} must declare ai_coding_session.runtime_location_id exactly once as nullable`,
  );
  assert.doesNotMatch(
    codingSessionTable,
    /^\s*runtime_location_id\b[^\r\n]*\bNOT\s+NULL\b/gim,
    `${sourceLabel} must preserve legacy unbound sessions as NULL-capable`,
  );
}

function assertWorkspaceBindingIsInBaseline(sql, sourceLabel) {
  for (const tableName of [
    'studio_project_workspace_binding',
    'studio_project_workspace_binding_idempotency',
    'ops_project_workspace_binding_audit',
  ]) {
    assert.equal(
      countCreateTableDeclarations(sql, tableName),
      1,
      `${sourceLabel} must contain the folded ${tableName} definition exactly once`,
    );
  }
}

const dataModule = await import(`${dataModulePath.href}?t=${Date.now()}`);
const providersModule = await import(`${providersModulePath.href}?t=${Date.now()}`);

const migrations = providersModule.BIRDCODER_SCHEMA_MIGRATIONS;
const migrationIds = migrations.map((migration) => migration.migrationId);

assert.deepEqual(migrationIds, [
  'runtime-data-kernel-v1',
  'coding-server-kernel-v2',
  'coding-session-runtime-location-v3',
]);
assert.equal(new Set(migrationIds).size, migrationIds.length, 'Migration ids must stay unique');

const codingSessionDefinition = dataModule.getBirdCoderEntityDefinition('coding_session');
const runtimeLocationColumns = codingSessionDefinition.columns.filter(
  (column) => column.name === 'runtime_location_id',
);
assert.equal(
  runtimeLocationColumns.length,
  1,
  'The current local coding-session schema must expose runtime_location_id exactly once',
);
assert.equal(
  runtimeLocationColumns[0].nullable,
  true,
  'The local coding-session schema must keep legacy unbound sessions nullable',
);

const codingServerKernelV2 = migrations.find(
  (migration) => migration.migrationId === 'coding-server-kernel-v2',
);
const runtimeLocationV3 = migrations.find(
  (migration) => migration.migrationId === 'coding-session-runtime-location-v3',
);

assert.ok(codingServerKernelV2, 'The historical v2 coding-session bootstrap migration must remain available');
assert.ok(runtimeLocationV3, 'The v3 runtime-location upgrade migration must remain available');
assert.deepEqual(
  runtimeLocationV3.entityNames,
  ['coding_session'],
  'The v3 upgrade must be scoped only to coding sessions',
);

for (const { id: engineId, providerId } of DATABASE_ENGINES) {
  for (const migration of migrations) {
    const statements = migration.sqlByProvider[providerId];

    assert.equal(
      Array.isArray(statements) && statements.length > 0,
      true,
      `${migration.migrationId} must provide ${providerId} statements`,
    );

    if (migration.migrationId === runtimeLocationV3.migrationId) {
      assert.equal(
        statements.length,
        1,
        `The v3 runtime-location upgrade must issue one ${providerId} statement`,
      );
      assert.match(
        statements[0],
        /^ALTER TABLE ai_coding_session ADD COLUMN runtime_location_id TEXT;$/i,
        `The v3 runtime-location upgrade must add one nullable column for ${providerId}`,
      );
      assert.doesNotMatch(
        statements[0],
        /NOT\s+NULL/i,
        `The v3 runtime-location upgrade must preserve legacy unbound ${providerId} sessions`,
      );
    } else {
      for (const statement of statements) {
        assert.match(
          statement,
          /IF NOT EXISTS/i,
          `${migration.migrationId} bootstrap SQL must stay replay-safe for ${providerId}`,
        );
      }
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

  assert.doesNotMatch(
    codingServerKernelV2.sqlByProvider[providerId].join('\n'),
    /\bruntime_location_id\b/i,
    `Historical v2 ${providerId} bootstrap SQL must not pre-create the v3 column`,
  );
  assert.equal(
    [...runtimeLocationV3.sqlByProvider[providerId].join('\n').matchAll(/\bruntime_location_id\b/gi)].length,
    1,
    `The v3 ${providerId} upgrade must add runtime_location_id once`,
  );

  const baselineFileNames = getSqlFileNames(
    DATABASE_ENGINES.find((engine) => engine.id === engineId).baselineDirectory,
  );
  assert.deepEqual(
    baselineFileNames,
    ['0001_birdcoder_baseline.sql'],
    `${engineId} must have one canonical initialization baseline`,
  );

  const migrationFileNames = getSqlFileNames(
    DATABASE_ENGINES.find((engine) => engine.id === engineId).migrationDirectory,
  );
  assert.deepEqual(
    migrationFileNames.filter((fileName) => fileName.endsWith('.up.sql')),
    [],
    `${engineId} must not carry pre-launch incremental .up.sql migrations`,
  );
}

for (const { id: engineId, baselineFile, generatedFile } of DATABASE_ENGINES) {
  const baselineSql = fs.readFileSync(baselineFile, 'utf8');
  const generatedSql = fs.readFileSync(generatedFile, 'utf8');

  assertLegacyRuntimeLocationColumn(baselineSql, `${engineId} baseline`);
  assertLegacyRuntimeLocationColumn(generatedSql, `${engineId} generated DDL`);
  assertWorkspaceBindingIsInBaseline(baselineSql, `${engineId} baseline`);
  assertWorkspaceBindingIsInBaseline(generatedSql, `${engineId} generated DDL`);
  assert.match(
    generatedSql,
    /-- Sources: baseline\(1\) \+ migrations\(0\)/,
    `${engineId} generated DDL must be materialized from the initialization baseline alone`,
  );
  assert.doesNotMatch(
    generatedSql,
    /ALTER TABLE ai_coding_session ADD COLUMN runtime_location_id/i,
    `${engineId} generated DDL must not retain an incremental runtime-location migration`,
  );
}

console.log('migration replay contract passed.');
