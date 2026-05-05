import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const desktopLibSource = fs.readFileSync(
  path.join(rootDir, 'packages/sdkwork-birdcoder-desktop/src-tauri/src/lib.rs'),
  'utf8',
);

assert.match(
  desktopLibSource,
  /static DESKTOP_RUNTIME_STARTUP:\s*OnceLock<\s*tokio::sync::OnceCell<Result<DesktopRuntimeConfig,\s*String>>\s*,?\s*>/s,
  'Desktop runtime startup must have a shared async OnceCell so setup and desktop_runtime_config do not race or duplicate embedded server startup.',
);

assert.match(
  desktopLibSource,
  /async fn ensure_desktop_runtime_config\(app: AppHandle\) -> Result<DesktopRuntimeConfig,\s*String> \{[\s\S]*tauri::async_runtime::spawn_blocking\(move \|\| start_embedded_coding_server\(&app\)\)/s,
  'Desktop runtime config resolution must move SQLite schema initialization and router construction off the Tauri setup thread.',
);

assert.match(
  desktopLibSource,
  /fn spawn_embedded_coding_server_startup\(app: AppHandle\) \{[\s\S]*tauri::async_runtime::spawn\(async move \{[\s\S]*ensure_desktop_runtime_config\(app\)\.await/s,
  'Desktop setup must schedule embedded server startup in the async runtime instead of blocking window creation.',
);

assert.match(
  desktopLibSource,
  /#\[tauri::command\]\s*async fn desktop_runtime_config\(app: AppHandle\) -> Result<DesktopRuntimeConfig,\s*String> \{[\s\S]*ensure_desktop_runtime_config\(app\)\.await/s,
  'desktop_runtime_config must await the shared startup task so the renderer can resolve the API URL without forcing synchronous setup work.',
);

const setupBlockMatch = desktopLibSource.match(/\.setup\(\|app\| \{[\s\S]*?\n        \}\)/s);
assert.ok(setupBlockMatch, 'Desktop Tauri builder setup hook must be present.');
assert.match(
  setupBlockMatch[0],
  /spawn_embedded_coding_server_startup\(app\.handle\(\)\.clone\(\)\);/,
  'Desktop setup must only dispatch embedded server startup and then return.',
);
assert.doesNotMatch(
  setupBlockMatch[0],
  /start_embedded_coding_server\(app\.handle\(\)\)\?/,
  'Desktop setup must not synchronously run SQLite initialization, migration, or server bootstrap before window creation.',
);

console.log('desktop embedded server startup performance contract passed.');
