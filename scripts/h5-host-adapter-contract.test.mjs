import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const corePrefix = 'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-core/src';
const capacitorPrefix = 'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-capacitor/src';

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const secureStorageSource = read(`${corePrefix}/host/secureStorageAdapter.ts`);
const sessionStorageSource = read(`${corePrefix}/session/birdCoderSessionStorage.ts`);
const capacitorAdapterSource = read(`${capacitorPrefix}/adapters/capacitorSecureStorageAdapter.ts`);
const mainSource = read('apps/sdkwork-birdcoder-h5/src/main.tsx');
const rootHostAdaptersSource = read('apps/sdkwork-birdcoder-h5/src/bootstrap/hostAdapters.ts');

assert.match(
  secureStorageSource,
  /export interface SecureStorageHostAdapter/u,
  'h5-core must own the secure storage host adapter contract.',
);
assert.match(
  secureStorageSource,
  /createBrowserSecureStorageAdapter/u,
  'h5-core must provide a browser fallback secure storage adapter.',
);

assert.match(
  sessionStorageSource,
  /APP_SESSION_STORAGE_KEY/u,
  'H5 session storage must use the canonical BirdCoder IAM session key.',
);
assert.match(
  sessionStorageSource,
  /authToken/u,
  'H5 session storage records must include authToken for IAM token hydration.',
);

assert.match(
  capacitorAdapterSource,
  /createCapacitorSecureStorageAdapter/u,
  'h5-capacitor must implement the native secure storage adapter.',
);
assert.match(
  capacitorAdapterSource,
  /createBrowserSecureStorageAdapter/u,
  'h5-capacitor must fall back to browser secure storage when native plugins are unavailable.',
);
assert.match(
  read(`${capacitorPrefix}/runtime/capacitorRuntime.ts`),
  /@capacitor\/preferences/u,
  'h5-capacitor must wire native secure storage through Capacitor Preferences.',
);
assert.match(
  read(`${capacitorPrefix}/adapters/capacitorDeepLinkAdapter.ts`),
  /@capacitor\/app/u,
  'h5-capacitor must wire native deep links through Capacitor App.',
);

assert.match(
  mainSource,
  /registerBirdCoderHostAdapters\(\)/u,
  'H5 entrypoint must register host adapters before bootstrap.',
);
assert.match(
  rootHostAdaptersSource,
  /from ['"]@sdkwork\/birdcoder-h5-capacitor['"]/u,
  'H5 root host adapter registration must delegate to the capacitor package boundary.',
);

console.log('h5 host adapter contract passed.');
