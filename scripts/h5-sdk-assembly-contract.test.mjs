import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const assemblyPath = 'apps/sdkwork-birdcoder-h5/sdks/.sdkwork-assembly.json';
const componentSpecPath = 'apps/sdkwork-birdcoder-h5/sdks/specs/component.spec.json';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

const assembly = readJson(assemblyPath);
const componentSpec = readJson(componentSpecPath);

assert.equal(assembly.kind, 'sdkwork.sdk.assembly');
assert.equal(assembly.name, 'sdkwork-birdcoder-h5-sdk-family');

const surfaces = assembly.surfaces ?? [];
const appSurface = surfaces.find((surface) => surface.surface === 'app');
const adminSurface = surfaces.find((surface) => surface.surface === 'backend-admin');

assert.ok(appSurface, 'H5 SDK assembly must declare an app surface.');
assert.ok(adminSurface, 'H5 SDK assembly must declare a backend-admin surface.');

assert.equal(appSurface.dependencyMode, 'consumer-sdk');
assert.equal(adminSurface.dependencyMode, 'consumer-sdk');
assert.equal(appSurface.composedPackageName, '@sdkwork/birdcoder-h5-core');
assert.equal(adminSurface.composedPackageName, '@sdkwork/birdcoder-h5-admin-core');

assert.match(
  appSurface.typescriptConsumerPath ?? '',
  /sdkwork-birdcoder-pc\/sdks\/sdkwork-birdcoder-app-sdk/u,
  'H5 app surface must consume the canonical PC-generated app SDK family.',
);
assert.match(
  adminSurface.typescriptConsumerPath ?? '',
  /sdkwork-birdcoder-pc\/sdks\/sdkwork-birdcoder-backend-sdk/u,
  'H5 backend-admin surface must consume the canonical PC-generated backend SDK family.',
);

assert.equal(componentSpec.ownerPackage, '@sdkwork/birdcoder-h5-core');
assert.equal(componentSpec.adminOwnerPackage, '@sdkwork/birdcoder-h5-admin-core');

console.log('h5 sdk assembly contract passed.');
