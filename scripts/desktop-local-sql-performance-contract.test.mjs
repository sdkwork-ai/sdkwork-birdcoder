import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const hostStateSource = await readFile(
  new URL('../crates/sdkwork-birdcoder-tauri-host/src/host/state.rs', import.meta.url),
  'utf8',
);
const sqlCommandsSource = await readFile(
  new URL('../crates/sdkwork-birdcoder-tauri-host/src/commands/sql_commands.rs', import.meta.url),
  'utf8',
);
const localStoreSource = await readFile(
  new URL(
    '../crates/sdkwork-birdcoder-tauri-host/src/commands/local_store_commands.rs',
    import.meta.url,
  ),
  'utf8',
);
const source = `${hostStateSource}\n${sqlCommandsSource}\n${localStoreSource}`;

assert.match(
  hostStateSource,
  /use std::sync::\{Mutex,\s*OnceLock\};/u,
  'Desktop local SQL bridge must keep a process-local initialization guard for expensive schema/bootstrap work.',
);
assert.match(
  hostStateSource,
  /static INITIALIZED_DATABASE_PATHS:\s*OnceLock<Mutex<HashSet<PathBuf>>>\s*=\s*OnceLock::new\(\);/u,
  'Desktop local SQL bridge must track initialized sqlite paths so frequent transcript reads do not rerun schema/bootstrap work.',
);
assert.match(
  hostStateSource,
  /fn ensure_database_ready\(\s*connection:\s*&Connection,\s*database_path:\s*&PathBuf,?\s*\)\s*->\s*Result<\(\),\s*String>\s*\{/u,
  'Desktop local SQL bridge must centralize one-time database readiness work.',
);
assert.match(
  hostStateSource,
  /if guard\.contains\(database_path\)\s*\{\s*return Ok\(\(\)\);\s*\}/u,
  'Database readiness must skip schema/bootstrap work after the current sqlite path has already been initialized.',
);
assert.match(
  hostStateSource,
  /ensure_database_ready\(&connection,\s*&database_path\)\?;/u,
  'open_database must call the guarded readiness path instead of rerunning schema/bootstrap unconditionally.',
);

for (const commandName of [
  'local_sql_execute_plan',
  'local_store_get',
  'local_store_set',
  'local_store_delete',
  'local_store_list',
]) {
  assert.match(
    source,
    new RegExp(`async fn ${commandName}[\\s\\S]*?tauri::async_runtime::spawn_blocking\\(move \\|\\|`, 'u'),
    `${commandName} must offload sqlite and filesystem-adjacent work through spawn_blocking.`,
  );
  assert.match(
    source,
    new RegExp(
      `async fn ${commandName}[\\s\\S]*?\\.await\\s*\\.map_err\\(\\|error\\| format!\\("failed to join .* task: \\{error\\}"\\)\\)\\?`,
      'u',
    ),
    `${commandName} must surface spawn_blocking join failures with an actionable bridge error.`,
  );
}

assert.match(
  sqlCommandsSource,
  /execute_local_sql_plan\(&mut connection,\s*&plan\)/u,
  'local_sql_execute_plan must still execute the validated local SQL plan inside the blocking task.',
);

console.log('desktop local SQL performance contract passed.');
