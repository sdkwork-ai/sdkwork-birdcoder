import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const componentSpecPath = 'apps/sdkwork-birdcoder-h5/sdks/specs/component.spec.json';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

const componentSpec = readJson(componentSpecPath);
const dependencies = componentSpec.contracts?.sdkDependencies ?? [];
const appSurface = dependencies.find((dependency) => dependency.surface === 'app');
const adminSurface = dependencies.find((dependency) => dependency.surface === 'backend-admin');

assert.ok(appSurface, 'H5 SDK assembly must declare an app surface.');
assert.ok(adminSurface, 'H5 SDK assembly must declare a backend-admin surface.');

assert.equal(appSurface.consumerPackageName, '@sdkwork/birdcoder-h5-core');
assert.equal(adminSurface.consumerPackageName, '@sdkwork/birdcoder-h5-admin-core');

assert.match(
  appSurface.manifestPath ?? '',
  /sdkwork-birdcoder-pc\/sdks\/sdkwork-birdcoder-app-sdk\/sdk-manifest\.json/u,
  'H5 app surface must consume the canonical PC-generated app SDK family.',
);
assert.match(
  adminSurface.manifestPath ?? '',
  /sdkwork-birdcoder-pc\/sdks\/sdkwork-birdcoder-backend-sdk\/sdk-manifest\.json/u,
  'H5 backend-admin surface must consume the canonical PC-generated backend SDK family.',
);

assert.equal(componentSpec.ownerPackage, '@sdkwork/birdcoder-h5-core');
assert.equal(componentSpec.adminOwnerPackage, '@sdkwork/birdcoder-h5-admin-core');

console.log('h5 sdk dependency contract passed.');
