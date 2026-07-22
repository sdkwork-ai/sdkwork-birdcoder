import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  readCanonicalServerRustSource,
} from './birdcoder-canonical-server-rust-sources.mjs';

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

function extractTables(sql) {
  return [...sql.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z0-9_]+)\s*\(([\s\S]*?)\n\);/gi)]
    .map((match) => ({ name: match[1], body: match[2] }));
}

const canonicalSqliteSchema = fs.readFileSync(
  new URL('../database/ddl/generated/sqlite_schema.sql', import.meta.url),
  'utf8',
);
const tables = extractTables(canonicalSqliteSchema);

assert.deepEqual(
  tables.map(({ name }) => name).sort(),
  EXPECTED_TABLES,
  'the Rust desktop/server host must embed exactly the canonical BirdCoder workbench schema',
);

for (const { name, body } of tables) {
  assert.match(
    body,
    /^\s*id\s+BIGINT\s+NOT\s+NULL\s+PRIMARY\s+KEY\s*,?$/im,
    `${name}.id must use the canonical application-preallocated BIGINT contract`,
  );
  assert.doesNotMatch(body, /^\s*id\s+INTEGER\s+(?:NOT\s+NULL\s+)?PRIMARY\s+KEY/im);
}

for (const retiredTable of [
  'ai_coding_session',
  'ai_coding_session_message',
  'chat_conversation',
  'chat_message',
  'studio_project_content',
  'studio_team',
  'studio_team_member',
  'studio_workspace_member',
  'studio_project_collaborator',
  'studio_project_workspace_binding',
]) {
  assert.equal(
    tables.some(({ name }) => name === retiredTable),
    false,
    `the canonical Rust schema must not retain ${retiredTable}`,
  );
}

assert.match(canonicalSqliteSchema, /\bdefault_agent_project_id\s+TEXT\s+NULL\b/i);
assert.match(canonicalSqliteSchema, /\bdocument_id\s+TEXT\s+NOT\s+NULL\b/i);
assert.match(canonicalSqliteSchema, /\bruntime_target_id\s+TEXT\s+NOT\s+NULL\b/i);
assert.match(canonicalSqliteSchema, /\bsandbox_id\s+TEXT\s+NOT\s+NULL\b/i);

const gatewayDatabaseSource = readCanonicalServerRustSource(
  'crates/sdkwork-api-birdcoder-standalone-gateway/src/bootstrap/database.rs',
);
const databaseHostSource = readCanonicalServerRustSource(
  'crates/sdkwork-birdcoder-database-host/src/lib.rs',
);

assert.match(gatewayDatabaseSource, /bootstrap_database\(/);
assert.match(
  gatewayDatabaseSource,
  /sdkwork_birdcoder_database_host::bootstrap_birdcoder_database/,
  'the standalone gateway must delegate schema lifecycle to the BirdCoder database host',
);
assert.match(databaseHostSource, /LifecycleOrchestrator/);
assert.match(databaseHostSource, /DefaultDatabaseModule::from_app_root/);

console.log('rust workspace/project schema parity contract passed.');
