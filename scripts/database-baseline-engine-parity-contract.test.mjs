import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

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

const EXPECTED_FOREIGN_KEYS = [
  'studio_project.workspace_id->studio_workspace.id',
  'studio_project_document_binding.project_id->studio_project.id',
  'studio_project_runtime_location.project_id->studio_project.id',
  'studio_project_runtime_location_audit.project_id->studio_project.id',
  'studio_project_runtime_location_audit.runtime_location_id->studio_project_runtime_location.id',
  'studio_project_runtime_location_idempotency.project_id->studio_project.id',
  'studio_project_runtime_location_preference.project_id->studio_project.id',
  'studio_project_runtime_location_preference.runtime_location_id->studio_project_runtime_location.id',
  'studio_project_sandbox_binding.project_id->studio_project.id',
  'studio_project_sandbox_binding_audit.project_id->studio_project.id',
  'studio_project_sandbox_binding_audit.sandbox_binding_id->studio_project_sandbox_binding.id',
  'studio_project_sandbox_binding_idempotency.project_id->studio_project.id',
].sort();

function read(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  assert.ok(fs.existsSync(absolutePath), `${relativePath} must exist`);
  return fs.readFileSync(absolutePath, 'utf8');
}

function extractTables(sql) {
  return [...sql.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z0-9_]+)\s*\(([\s\S]*?)\n\);/gi)]
    .map((match) => ({ name: match[1], body: match[2] }));
}

function extractForeignKeys(tables) {
  const foreignKeys = [];
  for (const { name: tableName, body } of tables) {
    for (const match of body.matchAll(
      /^\s*([a-z0-9_]+)\s+[^,\n]*?\sREFERENCES\s+([a-z0-9_]+)\s*\(([a-z0-9_]+)\)/gim,
    )) {
      foreignKeys.push(`${tableName}.${match[1]}->${match[2]}.${match[3]}`);
    }
  }
  return foreignKeys.sort();
}

const engines = [
  ['PostgreSQL', read('database/ddl/baseline/postgres/0001_birdcoder_baseline.sql')],
  ['SQLite', read('database/ddl/baseline/sqlite/0001_birdcoder_baseline.sql')],
];

for (const [engine, sql] of engines) {
  const tables = extractTables(sql);
  const tableNames = tables.map(({ name }) => name).sort();

  assert.deepEqual(
    tableNames,
    EXPECTED_TABLES,
    `${engine} must expose exactly the BirdCoder workbench table inventory`,
  );
  assert.deepEqual(
    extractForeignKeys(tables),
    EXPECTED_FOREIGN_KEYS,
    `${engine} must enforce local aggregate foreign keys and no cross-domain foreign keys`,
  );

  for (const { name, body } of tables) {
    assert.match(
      body,
      /^\s*id\s+BIGINT\s+NOT\s+NULL\s+PRIMARY\s+KEY\s*,?$/im,
      `${engine} ${name}.id must be an application-preallocated BIGINT primary key`,
    );
    assert.doesNotMatch(
      body,
      /\b(?:SERIAL|BIGSERIAL|AUTOINCREMENT|GENERATED\s+(?:ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY)\b/i,
      `${engine} ${name} must not allocate identifiers inside the database`,
    );
    assert.doesNotMatch(
      body,
      /^\s*id\s+INTEGER\s+(?:NOT\s+NULL\s+)?PRIMARY\s+KEY/im,
      `${engine} ${name} must not rely on SQLite rowid allocation`,
    );
  }

  assert.match(sql, /\bdefault_agent_project_id\s+TEXT\s+NULL\b/i);
  assert.match(sql, /\bdocument_id\s+TEXT\s+NOT\s+NULL\b/i);
  assert.match(sql, /\bruntime_target_id\s+TEXT\s+NOT\s+NULL\b/i);
  assert.match(sql, /\bsandbox_id\s+TEXT\s+NOT\s+NULL\b/i);
  assert.match(sql, /\broot_entry_id\s+TEXT\s+NOT\s+NULL\b/i);
  assert.match(sql, /default_agent_project_id\s+IS\s+NULL\s+OR\s+default_agent_project_id\s+LIKE\s+'project\.%'/i);
}

const tableRegistry = JSON.parse(read('database/contract/table-registry.json'));
assert.deepEqual(
  tableRegistry.tables.map((entry) => entry.table_name).sort(),
  EXPECTED_TABLES,
  'table-registry.json must match the canonical workbench table inventory',
);
assert.ok(
  tableRegistry.tables.every(
    (entry) => entry.owner === 'birdcoder-workbench' && entry.lifecycle_status === 'active',
  ),
  'every registered table must have one active BirdCoder workbench owner',
);

const schemaYaml = read('database/contract/schema.yaml');
const schemaTableNames = [...schemaYaml.matchAll(/^\s+- name: ([a-z0-9_]+)\s*$/gim)]
  .map((match) => match[1])
  .sort();
assert.deepEqual(schemaTableNames, EXPECTED_TABLES, 'schema.yaml must match the table registry');
assert.match(schemaYaml, /^table_prefix:\s+studio_\s*$/m);
assert.doesNotMatch(schemaYaml, /(?:ai_|chat_|ops_|commerce_|membership_|deployment_)/i);

console.log('database baseline engine parity contract passed.');
