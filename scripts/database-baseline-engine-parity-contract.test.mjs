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

function extractInlineForeignKeys(sql) {
  const foreignKeys = new Set();
  for (const tableMatch of sql.matchAll(
    /CREATE TABLE IF NOT EXISTS ([a-z0-9_]+)\s*\(([\s\S]*?)\n\);/gi,
  )) {
    const [, tableName, body] = tableMatch;
    for (const columnMatch of body.matchAll(
      /^\s*([a-z0-9_]+)\s+[^,\n]*\sREFERENCES\s+([a-z0-9_]+)\s*\(([a-z0-9_]+)\)/gim,
    )) {
      foreignKeys.add(`${tableName}.${columnMatch[1]}->${columnMatch[2]}.${columnMatch[3]}`);
    }
  }
  return foreignKeys;
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

const requiredSqliteForeignKeys = [
  'ai_coding_session_message.coding_session_id->ai_coding_session.id',
  'ai_coding_session_runtime.coding_session_id->ai_coding_session.id',
  'ai_coding_session_turn.coding_session_id->ai_coding_session.id',
  'ai_coding_session_event.coding_session_id->ai_coding_session.id',
  'ai_coding_session_artifact.coding_session_id->ai_coding_session.id',
  'ai_coding_session_checkpoint.coding_session_id->ai_coding_session.id',
  'ai_coding_session_operation.coding_session_id->ai_coding_session.id',
  'ai_coding_session_prompt_entry.coding_session_id->ai_coding_session.id',
  'studio_project.workspace_id->studio_workspace.id',
  'studio_project_content.project_id->studio_project.id',
  'studio_team_member.team_id->studio_team.id',
  'studio_workspace_member.workspace_id->studio_workspace.id',
  'studio_project_collaborator.project_id->studio_project.id',
  'ai_skill_version.skill_package_id->ai_skill_package.id',
  'ai_skill_capability.skill_version_id->ai_skill_version.id',
  'ai_skill_installation.skill_version_id->ai_skill_version.id',
  'studio_app_template_version.app_template_id->studio_app_template.id',
  'studio_app_template_target_profile.app_template_version_id->studio_app_template_version.id',
  'studio_app_template_preset.app_template_version_id->studio_app_template_version.id',
  'studio_app_template_instantiation.app_template_version_id->studio_app_template_version.id',
  'studio_deployment_record.target_id->studio_deployment_target.id',
  'commerce_invoice.order_id->commerce_order.id',
  'commerce_payment.order_id->commerce_order.id',
];
const sqliteForeignKeys = extractInlineForeignKeys(sqliteBaseline);
for (const foreignKey of requiredSqliteForeignKeys) {
  assert.ok(
    sqliteForeignKeys.has(foreignKey),
    `SQLite baseline must enforce ${foreignKey} inline`,
  );
}

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
