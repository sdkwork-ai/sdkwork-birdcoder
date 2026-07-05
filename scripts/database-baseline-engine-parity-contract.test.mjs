import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqliteBaseline = fs.readFileSync(
  path.join(root, 'database/ddl/baseline/sqlite/0001_birdcoder_baseline.sql'),
  'utf8',
);
const postgresBaseline = fs.readFileSync(
  path.join(root, 'database/ddl/baseline/postgres/0001_birdcoder_baseline.sql'),
  'utf8',
);

function tableNames(sql) {
  const names = new Set();
  for (const match of sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z0-9_]+)/gi)) {
    names.add(match[1].toLowerCase());
  }
  return names;
}

const sqliteTables = tableNames(sqliteBaseline);
const postgresTables = tableNames(postgresBaseline);

assert.equal(
  sqliteTables.size,
  postgresTables.size,
  `sqlite/postgres baseline table count mismatch (${sqliteTables.size} vs ${postgresTables.size})`,
);

for (const table of sqliteTables) {
  assert.ok(postgresTables.has(table), `postgres baseline missing table ${table}`);
}

for (const table of postgresTables) {
  assert.ok(sqliteTables.has(table), `sqlite baseline missing table ${table}`);
}

console.log(`database baseline engine parity contract passed (${sqliteTables.size} tables)`);
