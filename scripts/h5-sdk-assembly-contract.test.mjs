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
const appSurface = dependencies.find((dependency) => dependency.surface === 'app-api');

assert.ok(appSurface, 'H5 SDK assembly must declare an app surface.');
assert.equal(dependencies.length, 1, 'H5 must consume only the BirdCoder App SDK family.');
assert.equal(appSurface.workspace, 'sdkwork-birdcoder-app-sdk');

assert.equal(appSurface.consumerPackageName, '@sdkwork/birdcoder-h5-core');

assert.match(
  appSurface.manifestPath ?? '',
  /\.\.\/\.\.\/\.\.\/\.\.\/sdks\/sdkwork-birdcoder-app-sdk\/sdk-manifest\.json/u,
  'H5 app surface must consume the application-root App SDK family.',
);

console.log('H5 App-only SDK dependency contract passed.');
