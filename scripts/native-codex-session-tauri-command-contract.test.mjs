import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const desktopLibRsPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'src',
  'lib.rs',
);
const desktopAppPermissionsPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'permissions',
  'default.toml',
);

const desktopLibRsSource = fs.readFileSync(desktopLibRsPath, 'utf8');
const desktopAppPermissionsSource = fs.readFileSync(desktopAppPermissionsPath, 'utf8');

for (const commandName of [
  'codex_native_session_file_list',
  'codex_native_session_index_read',
  'codex_native_session_read_file',
]) {
  assert.match(
    desktopLibRsSource,
    new RegExp(`\\b${commandName}\\b`, 'u'),
    `Desktop Rust bridge must expose ${commandName} so the Tauri WebView can load native Codex sessions without Node builtins.`,
  );

  assert.match(
    desktopAppPermissionsSource,
    new RegExp(`commands\\.allow\\s*=\\s*\\[[^\\]]*"${commandName}"[^\\]]*\\]`, 'u'),
    `Desktop default permission manifest must allow ${commandName} so native Codex session loading does not fail with runtime authorization errors.`,
  );
}

console.log('native codex session tauri command contract passed.');
