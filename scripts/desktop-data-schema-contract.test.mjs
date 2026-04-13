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
]) {
  assert.match(rustSource, new RegExp(requiredTable), `Missing schema table: ${requiredTable}`);
}

for (const requiredIndex of [
  'idx_run_configurations_scope_group',
  'idx_terminal_executions_session_started',
]) {
  assert.match(rustSource, new RegExp(requiredIndex), `Missing schema index: ${requiredIndex}`);
}

console.log('desktop data schema contract passed.');
