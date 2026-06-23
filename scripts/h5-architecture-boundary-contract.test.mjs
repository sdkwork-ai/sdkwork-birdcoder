import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const h5SrcDir = path.join(rootDir, 'apps/sdkwork-birdcoder-h5/src');
const h5CoreIndex = read('apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-core/src/index.ts');
const h5AdminCoreIndex = read('apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-admin-core/src/index.ts');
const h5CoreAppSdk = read('apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-core/src/sdk/appSdkClient.ts');
const h5AdminBackendSdk = read(
  'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-admin-core/src/sdk/backendSdkClient.ts',
);

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function collectSourceFiles(relativeDir) {
  const absoluteDir = path.join(rootDir, relativeDir);
  const files = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  }

  walk(absoluteDir);
  return files;
}

const forbiddenRootImports = [
  '@sdkwork/birdcoder-pc-infrastructure',
  '@sdkwork/birdcoder-pc-shell-runtime',
  '@sdkwork/birdcoder-pc-shell',
];

for (const sourceFile of collectSourceFiles('apps/sdkwork-birdcoder-h5/src')) {
  const relativePath = path.relative(rootDir, sourceFile).replaceAll('\\', '/');
  const source = fs.readFileSync(sourceFile, 'utf8');
  for (const forbiddenImport of forbiddenRootImports) {
    assert.doesNotMatch(
      source,
      new RegExp(`from ['"]${forbiddenImport.replace('/', '\\/')}['"]`, 'u'),
      `${relativePath} must not import ${forbiddenImport} directly; use h5-core or h5-shell package boundaries.`,
    );
  }
}

assert.match(
  h5CoreAppSdk,
  /getBirdCoderGeneratedAppSdkClient/u,
  'h5-core must construct the generated app SDK client.',
);
assert.doesNotMatch(
  h5CoreIndex,
  /BackendSdk|getBirdCoderGeneratedBackendSdkClient/u,
  'h5-core must not export backend SDK wrappers.',
);

assert.match(
  h5AdminBackendSdk,
  /getBirdCoderGeneratedBackendSdkClient/u,
  'h5-admin-core must own backend SDK client construction.',
);
assert.doesNotMatch(
  h5AdminCoreIndex,
  /getBirdCoderGeneratedAppSdkClient/u,
  'h5-admin-core must not export app SDK wrappers.',
);

console.log('h5 architecture boundary contract passed.');
