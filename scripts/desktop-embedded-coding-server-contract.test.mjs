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
const desktopPermissionsPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'permissions',
  'default.toml',
);
const desktopMainPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src',
  'main.tsx',
);

const desktopLibRsSource = fs.readFileSync(desktopLibRsPath, 'utf8');
const desktopPermissionsSource = fs.readFileSync(desktopPermissionsPath, 'utf8');
const desktopMainSource = fs.readFileSync(desktopMainPath, 'utf8');

assert.doesNotMatch(
  desktopLibRsSource,
  /TcpListener::bind\(BIRD_SERVER_DEFAULT_BIND_ADDRESS\)/,
  'Desktop embedded coding server must not hard-fail startup by binding only the fixed default API port.',
);

assert.match(
  desktopLibRsSource,
  /desktop_runtime_config/,
  'Desktop Rust host must expose a runtime config command so the webview can learn the actual embedded API base URL.',
);

assert.doesNotMatch(
  desktopLibRsSource,
  /let listener = tokio::net::TcpListener::from_std\(listener\)/,
  'Desktop embedded coding server must adopt the std listener inside the async runtime instead of panicking during the synchronous Tauri setup hook.',
);

assert.match(
  desktopPermissionsSource,
  /"desktop_runtime_config"/,
  'Desktop permission manifest must allow the desktop_runtime_config command.',
);

assert.match(
  desktopMainSource,
  /desktop_runtime_config/,
  'Desktop shell bootstrap must resolve API base URL from the Tauri runtime config before binding API-backed services.',
);

console.log('desktop embedded coding server contract passed.');
