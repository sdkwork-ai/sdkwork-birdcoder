import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rustLibPath = new URL(
  '../packages/sdkwork-birdcoder-desktop/src-tauri/src/lib.rs',
  import.meta.url,
);

const rustSource = await readFile(rustLibPath, 'utf8');

for (const requiredTable of [
  'CREATE TABLE IF NOT EXISTS schema_migration_history',
  'CREATE TABLE IF NOT EXISTS run_configurations',
  'CREATE TABLE IF NOT EXISTS terminal_executions',
  'CREATE TABLE IF NOT EXISTS coding_session_prompt_entries',
  'CREATE TABLE IF NOT EXISTS saved_prompt_entries',
]) {
  assert.match(rustSource, new RegExp(requiredTable), `Missing schema table: ${requiredTable}`);
}

for (const requiredIndex of [
  'idx_run_configurations_scope_group',
  'idx_terminal_executions_session_started',
  'idx_coding_session_prompt_entries_session_last_used',
  'uk_coding_session_prompt_entries_session_normalized_prompt',
  'idx_saved_prompt_entries_last_saved',
  'uk_saved_prompt_entries_normalized_prompt',
]) {
  assert.match(rustSource, new RegExp(requiredIndex), `Missing schema index: ${requiredIndex}`);
}

console.log('desktop data schema contract passed.');
