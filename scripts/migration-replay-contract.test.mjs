import assert from 'node:assert/strict';
import fs from 'node:fs';

const EXPECTED_TABLES = [
  'studio_project',
  'studio_project_document_binding',
  'studio_project_runtime_location',
  'studio_project_runtime_location_audit',
  'studio_project_runtime_location_idempotency',
  'studio_project_runtime_location_preference',
  'studio_project_sandbox_binding',
  'studio_project_sandbox_binding_audit',
  'studio_project_sandbox_binding_idempotency',
  'studio_workspace',
].sort();

const DATABASE_ENGINES = [
  {
    id: 'sqlite',
    baselineDirectory: new URL('../database/ddl/baseline/sqlite/', import.meta.url),
    baselineFile: new URL('../database/ddl/baseline/sqlite/0001_birdcoder_baseline.sql', import.meta.url),
    generatedFile: new URL('../database/ddl/generated/sqlite_schema.sql', import.meta.url),
    migrationDirectory: new URL('../database/migrations/sqlite/', import.meta.url),
  },
  {
    id: 'postgres',
    baselineDirectory: new URL('../database/ddl/baseline/postgres/', import.meta.url),
    baselineFile: new URL('../database/ddl/baseline/postgres/0001_birdcoder_baseline.sql', import.meta.url),
    generatedFile: new URL('../database/ddl/generated/postgres_schema.sql', import.meta.url),
    migrationDirectory: new URL('../database/migrations/postgres/', import.meta.url),
  },
];

function getSqlFileNames(directoryUrl) {
  return fs
    .readdirSync(directoryUrl, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();
}

function extractTableNames(sql) {
  return [...sql.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z0-9_]+)\s*\(/gi)]
    .map((match) => match[1])
    .sort();
}

function assertNoRetiredAuthorities(tableNames, sourceLabel) {
  const retired = tableNames.filter((tableName) =>
    /^(?:ai_|chat_|ops_|runtime_)/.test(tableName)
      || /(?:workspace_binding|project_content|skill|template|team|member|collaborator|commerce|order|invoice|payment|deployment)/.test(tableName),
  );
  assert.deepEqual(retired, [], `${sourceLabel} must not retain retired domain tables`);
}

for (const engine of DATABASE_ENGINES) {
  assert.deepEqual(
    getSqlFileNames(engine.baselineDirectory),
    ['0001_birdcoder_baseline.sql'],
    `${engine.id} must have one greenfield initialization baseline`,
  );
  assert.deepEqual(
    getSqlFileNames(engine.migrationDirectory).filter((fileName) => fileName.endsWith('.up.sql')),
    [],
    `${engine.id} must have no pre-launch incremental migrations`,
  );

  const baselineSql = fs.readFileSync(engine.baselineFile, 'utf8');
  const generatedSql = fs.readFileSync(engine.generatedFile, 'utf8');
  const baselineTables = extractTableNames(baselineSql);
  const generatedTables = extractTableNames(generatedSql);

  assert.deepEqual(baselineTables, EXPECTED_TABLES, `${engine.id} baseline inventory must be canonical`);
  assert.deepEqual(generatedTables, EXPECTED_TABLES, `${engine.id} generated inventory must be canonical`);
  assert.deepEqual(generatedTables, baselineTables, `${engine.id} generated DDL must replay the baseline exactly`);
  assert.match(
    generatedSql,
    /-- Sources: baseline\(1\) \+ migrations\(0\)/,
    `${engine.id} generated DDL must be materialized from one baseline and zero migrations`,
  );
  assert.doesNotMatch(generatedSql, /^\s*ALTER\s+TABLE\b/im);
  assertNoRetiredAuthorities(baselineTables, `${engine.id} baseline`);
  assertNoRetiredAuthorities(generatedTables, `${engine.id} generated DDL`);
}

console.log('migration replay contract passed.');
