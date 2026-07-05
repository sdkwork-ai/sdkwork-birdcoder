import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  assert.ok(fs.existsSync(absolutePath), `${relativePath} must exist`);
  return fs.readFileSync(absolutePath, 'utf8');
}

function extractTableNames(sql) {
  return [...sql.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z0-9_]+)/gi)]
    .map((match) => match[1])
    .sort();
}

const sqliteBaseline = read('database/ddl/baseline/sqlite/0001_birdcoder_baseline.sql');
const postgresBaseline = read('database/ddl/baseline/postgres/0001_birdcoder_baseline.sql');

const sqliteTables = extractTableNames(sqliteBaseline);
const postgresTables = extractTableNames(postgresBaseline);

assert.deepEqual(
  postgresTables,
  sqliteTables,
  'PostgreSQL and SQLite baselines must declare the same table inventory',
);

const schemaYaml = read('database/contract/schema.yaml');
const tableRegistry = JSON.parse(read('database/contract/table-registry.json'));

const registryTableNames = tableRegistry.tables.map((entry) => entry.table_name).sort();

assert.deepEqual(
  registryTableNames,
  sqliteTables,
  'table-registry.json must match baseline table inventory',
);

for (const prefix of ['chat_']) {
  assert.match(schemaYaml, new RegExp(`- ${prefix}`), `schema.yaml must register ${prefix} prefix`);
}

assert.match(
  schemaYaml,
  /- name: chat_conversation/,
  'schema.yaml must list chat_conversation',
);
assert.match(
  schemaYaml,
  /- name: chat_message/,
  'schema.yaml must list chat_message',
);

const dialectSource = read('crates/sdkwork-birdcoder-sqlx-repository-pool/src/dialect.rs');
assert.match(
  dialectSource,
  /is_deleted IS NOT TRUE/,
  'sqlx repository dialect must use cross-engine soft-delete predicate',
);

console.log('database baseline engine parity contract passed.');
