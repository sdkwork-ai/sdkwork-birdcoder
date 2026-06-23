import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const persistenceSource = read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-core/src/appSessionPersistence.ts');
const tokenSource = read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-core/src/appSessionToken.ts');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

assert.match(
  persistenceSource,
  /APP_SESSION_STORAGE_KEY = 'sdkwork\.birdcoder\.appSession\.v1'/u,
  'pc-core must own the canonical IAM app session storage key.',
);
assert.match(
  persistenceSource,
  /export interface AppSessionPersistencePort/u,
  'pc-core must expose an injectable app session persistence port.',
);
assert.match(
  persistenceSource,
  /export async function hydrateAppSessionPersistence/u,
  'pc-core must support async persistence hydration for secure host adapters.',
);

assert.match(
  tokenSource,
  /getAppSessionPersistencePort\(\)/u,
  'appSessionToken must read and write through the persistence port.',
);
assert.doesNotMatch(
  tokenSource,
  /globalThis\.sessionStorage\?\.getItem\(APP_SESSION_STORAGE_KEY\)/u,
  'appSessionToken must not read sessionStorage directly after port extraction.',
);

console.log('app session persistence port contract passed.');
