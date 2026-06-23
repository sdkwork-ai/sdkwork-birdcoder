import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const capacitorPrefix = 'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-capacitor';

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const runtimeSource = read(`${capacitorPrefix}/src/runtime/capacitorRuntime.ts`);
const adapterSource = read(`${capacitorPrefix}/src/adapters/capacitorSecureStorageAdapter.ts`);
const packageJson = JSON.parse(read(`${capacitorPrefix}/package.json`));
const h5PackageJson = JSON.parse(read('apps/sdkwork-birdcoder-h5/package.json'));

assert.equal(packageJson.dependencies['@capacitor/core'], 'catalog:');
assert.equal(packageJson.dependencies['@capacitor/preferences'], 'catalog:');

assert.match(
  runtimeSource,
  /from '@capacitor\/core'/u,
  'h5-capacitor must use the official Capacitor core runtime.',
);
assert.match(
  runtimeSource,
  /from '@capacitor\/preferences'/u,
  'h5-capacitor must use the official Capacitor Preferences plugin.',
);
assert.match(
  runtimeSource,
  /Capacitor\.isNativePlatform/u,
  'h5-capacitor must detect native platforms through Capacitor runtime facts.',
);

assert.match(
  adapterSource,
  /Preferences/u,
  'Capacitor secure storage must persist through the Preferences plugin on native targets.',
);
assert.match(
  adapterSource,
  /createBrowserSecureStorageAdapter/u,
  'Capacitor secure storage must fall back to browser storage on web targets.',
);

assert.equal(
  h5PackageJson.devDependencies['@capacitor/cli'],
  'catalog:',
  'H5 app root must declare Capacitor CLI for native sync/build scripts.',
);

console.log('h5 capacitor preferences contract passed.');
