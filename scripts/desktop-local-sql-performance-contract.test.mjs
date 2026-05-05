import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const desktopLibRsPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'src',
  'lib.rs',
);

const source = fs.readFileSync(desktopLibRsPath, 'utf8');

function readCommandBody(commandName) {
  const declaration = new RegExp(
    `#\\[tauri::command\\]\\s+async\\s+fn\\s+${commandName}\\s*\\([\\s\\S]*?\\)\\s*->\\s*Result[^\\{]+\\{(?<body>[\\s\\S]*?)\\n\\}`,
    'u',
  );
  const match = declaration.exec(source);
  assert.ok(
    match?.groups?.body,
    `${commandName} must be an async Tauri command so database work is not executed on the IPC handler thread.`,
  );
  return match.groups.body;
}

assert.match(
  source,
  /use std::sync::\{Mutex,\s*OnceLock\};/u,
  'Desktop local SQL bridge must keep a process-local initialization guard for expensive schema/bootstrap work.',
);
assert.match(
  source,
  /static INITIALIZED_DATABASE_PATHS:\s*OnceLock<Mutex<HashSet<PathBuf>>>\s*=\s*OnceLock::new\(\);/u,
  'Desktop local SQL bridge must track initialized sqlite paths so frequent transcript reads do not rerun schema/bootstrap work.',
);
assert.match(
  source,
  /fn ensure_database_ready\(\s*connection:\s*&Connection,\s*database_path:\s*&Path,?\s*\)\s*->\s*Result<\(\),\s*String>\s*\{/u,
  'Desktop local SQL bridge must centralize one-time database readiness work.',
);
assert.match(
  source,
  /if initialized_paths\.contains\(database_path\)\s*\{\s*return Ok\(\(\)\);\s*\}/u,
  'Database readiness must skip schema/bootstrap work after the current sqlite path has already been initialized.',
);
assert.match(
  source,
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
  const body = readCommandBody(commandName);
  assert.match(
    body,
    /tauri::async_runtime::spawn_blocking\(move \|\|/u,
    `${commandName} must offload sqlite and filesystem-adjacent work through spawn_blocking.`,
  );
  assert.match(
    body,
    /\.await\s*\.map_err\(\|error\| format!\("failed to join .* task: \{error\}"\)\)\?/u,
    `${commandName} must surface spawn_blocking join failures with an actionable bridge error.`,
  );
}

assert.match(
  readCommandBody('local_sql_execute_plan'),
  /execute_local_sql_plan\(&mut connection,\s*&plan\)/u,
  'local_sql_execute_plan must still execute the validated local SQL plan inside the blocking task.',
);

console.log('desktop local SQL performance contract passed.');
