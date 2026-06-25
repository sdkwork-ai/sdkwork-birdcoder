import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const bindingSource = read(
  'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-core/src/bootstrap/appSessionPersistenceBinding.ts',
);
const bootstrapSource = read(
  'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-shell/src/bootstrap/createBootstrapRuntime.ts',
);
const capacitorHostSource = read(
  'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-capacitor/src/hostAdapters.ts',
);

assert.match(
  bindingSource,
  /bindAppSessionPersistencePort/u,
  'H5 must bind the pc-core app session persistence port.',
);
assert.match(
  bindingSource,
  /getBirdCoderSecureStorageAdapter/u,
  'H5 app session persistence must route through the secure storage host adapter.',
);
assert.match(
  bindingSource,
  /hydrateAppSessionPersistence/u,
  'H5 must hydrate IAM session state from secure storage before bootstrap reads it.',
);

assert.match(
  bootstrapSource,
  /await hydrateBirdCoderH5AppSessionPersistence\(\)/u,
  'H5 bootstrap must hydrate IAM session persistence before shell runtime bootstrap.',
);

assert.match(
  capacitorHostSource,
  /bindBirdCoderH5AppSessionPersistence\(\)/u,
  'Capacitor host adapter registration must bind IAM session persistence.',
);

console.log('h5 app session persistence contract passed.');
