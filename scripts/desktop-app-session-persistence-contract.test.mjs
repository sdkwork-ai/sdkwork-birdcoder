import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const bindingSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/bootstrap/appSessionPersistenceBinding.ts',
);
const desktopMainSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src/main.tsx',
);
const secureStoreSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/platform/secureAppSessionStore.ts',
);
const hostStoreSource = read(
  'crates/sdkwork-birdcoder-tauri-host/src/adapters/secure_app_session_store.rs',
);
const desktopHostSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src-tauri/src/lib.rs',
);
const permissionsSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src-tauri/permissions/default.toml',
);

assert.match(
  bindingSource,
  /writeSecureAppSession\(raw\)/u,
  'Desktop IAM session persistence must write through the dedicated secure host adapter.',
);
assert.doesNotMatch(
  bindingSource,
  /local_store|storage\/runtime|setStoredRawValue|getStoredRawValue/u,
  'Desktop IAM session persistence must never use generic local storage or business SQL storage.',
);
assert.match(
  bindingSource,
  /export async function hydrateBirdCoderDesktopAppSessionPersistence/u,
  'Desktop must expose async IAM session hydration before shell bootstrap.',
);

for (const command of [
  'secure_app_session_read',
  'secure_app_session_write',
  'secure_app_session_delete',
]) {
  assert.match(secureStoreSource, new RegExp(`'${command}'`, 'u'));
  assert.match(desktopHostSource, new RegExp(`\\b${command}\\b`, 'u'));
  assert.match(permissionsSource, new RegExp(command.replaceAll('_', '-'), 'u'));
}
assert.match(
  hostStoreSource,
  /keyring::\{Entry/u,
  'Desktop IAM session credentials must use the operating-system credential store.',
);
assert.doesNotMatch(
  hostStoreSource,
  /rusqlite|kv_store|local_store/u,
  'The secure session adapter must not persist credentials in SQLite or generic local storage.',
);

assert.match(
  desktopMainSource,
  /hydrateBirdCoderDesktopAppSessionPersistence/u,
  'Desktop main entry must hydrate secure IAM session persistence before rendering the shell.',
);

console.log('desktop app session persistence contract passed.');
