import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const schemaSources = await Promise.all([
  readFile(
    new URL(
      '../crates/sdkwork-birdcoder-tauri-host/src/host/state.rs',
      import.meta.url,
    ),
    'utf8',
  ),
  readFile(
    new URL(
      '../crates/sdkwork-birdcoder-workspace-repository-sqlx/src/db/schema.rs',
      import.meta.url,
    ),
    'utf8',
  ),
  readFile(
    new URL(
      '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/data.ts',
      import.meta.url,
    ),
    'utf8',
  ),
  readFile(
    new URL(
      '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/runConfigurationStorage.ts',
      import.meta.url,
    ),
    'utf8',
  ),
]);

const schemaSource = schemaSources.join('\n');

for (const requiredTable of [
  'ops_schema_migration_history',
  'ops_run_configuration',
  'ops_terminal_execution',
  'ai_coding_session_prompt_entry',
  'ai_saved_prompt_entry',
  'ops_release_record',
]) {
  assert.match(schemaSource, new RegExp(requiredTable), `Missing schema table: ${requiredTable}`);
}

for (const requiredIndex of [
  'idx_ops_run_configuration_scope_group',
  'idx_ops_terminal_execution_session_started',
  'idx_ai_coding_session_prompt_entry_session_last_used',
  'uk_ai_coding_session_prompt_entry_session_normalized_prompt',
  'idx_ai_saved_prompt_entry_last_saved',
  'uk_ai_saved_prompt_entry_normalized_prompt',
  'uk_ops_release_record_version',
]) {
  assert.match(schemaSource, new RegExp(requiredIndex), `Missing schema index: ${requiredIndex}`);
}

assert.doesNotMatch(
  schemaSource,
  /\buk_release_records_version\b|CREATE TABLE(?: IF NOT EXISTS)? release_records\b|"release_records"/u,
  'Desktop schema must use ops_release_record table and uk_ops_release_record_version index only.',
);

assert.doesNotMatch(
  schemaSource,
  /LEGACY_DESKTOP_SQLITE_FILE_NAME|backfill_legacy_run_configuration_config_keys|derive_legacy_run_configuration_config_key|legacy_desktop_local_sibling_database_path|read_legacy_desktop_local_projects|import_legacy_desktop_local_projects_from_sibling|LegacyDesktopLocalProject/u,
  'Desktop runtime is a new app and must not retain legacy sqlite import or run-configuration backfill paths.',
);

assert.doesNotMatch(
  schemaSource,
  /legacy authority local-store|legacy authority backfill/u,
  'Desktop runtime must describe reserved authority-table cleanup without legacy compatibility wording.',
);

assert.doesNotMatch(
  schemaSource,
  /app_dir\.push\("sdkwork-birdcoder\.sqlite3"\)|with_file_name\(LEGACY_DESKTOP_SQLITE_FILE_NAME\)/u,
  'Desktop runtime must use sdkwork-birdcoder-pc-desktop-local.sqlite3 as the canonical local sqlite file name.',
);

assert.match(
  schemaSources[0],
  /app_dir\.push\(DESKTOP_LOCAL_SQLITE_FILE_NAME\)/u,
  'Desktop runtime must resolve the default local sqlite path through DESKTOP_LOCAL_SQLITE_FILE_NAME.',
);

console.log('desktop data schema contract passed.');
