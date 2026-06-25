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

assert.match(
  bindingSource,
  /DESKTOP_APP_SESSION_SCOPE = 'secure-app-session'/u,
  'Desktop IAM session persistence must use the secure-app-session scope.',
);
assert.match(
  bindingSource,
  /setStoredRawValue\(DESKTOP_APP_SESSION_SCOPE, APP_SESSION_STORAGE_KEY/u,
  'Desktop IAM session persistence must write through Tauri local_store via setStoredRawValue.',
);
assert.match(
  bindingSource,
  /export async function hydrateBirdCoderDesktopAppSessionPersistence/u,
  'Desktop must expose async IAM session hydration before shell bootstrap.',
);

assert.match(
  desktopMainSource,
  /hydrateBirdCoderDesktopAppSessionPersistence/u,
  'Desktop main entry must hydrate secure IAM session persistence before rendering the shell.',
);

console.log('desktop app session persistence contract passed.');
