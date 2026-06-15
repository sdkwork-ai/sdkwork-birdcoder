import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');

function readPackageJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(workspaceRoot, relativePath, 'package.json'), 'utf8'),
  );
}

const rootPackageJson = readPackageJson('.');
const webPackageJson = readPackageJson('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web');

assert.equal(
  rootPackageJson.scripts?.['dev:test'],
  'node scripts/run-birdcoder-dev-stack.mjs web --iam-mode server-private --vite-mode test',
  'Root dev:test must start the standardized server+client stack so appbase-backed test pages never target an unstarted :10240 API.',
);
assert.equal(
  webPackageJson.scripts?.['dev:test'],
  'node ../../scripts/run-birdcoder-dev-stack.mjs web --iam-mode server-private --vite-mode test',
  'Web package dev:test must use the standardized private server stack instead of launching only the Vite client.',
);

console.log('web dev:test stack entry contract passed.');
