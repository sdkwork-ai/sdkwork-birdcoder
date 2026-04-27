import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function pathExists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

const shellRootSource = readText('packages/sdkwork-birdcoder-shell/src/index.ts');
const shellRuntimeRootSource = readText('packages/sdkwork-birdcoder-shell-runtime/src/index.ts');
const shellRuntimeBootstrapServerBaseUrlSource = readText(
  'packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/bootstrapServerBaseUrl.ts',
);
const lazyDefaultIdeServicesSource = readText(
  'packages/sdkwork-birdcoder-commons/src/context/lazyDefaultIdeServices.ts',
);
const defaultIdeServicesLoaderSource = readText(
  'packages/sdkwork-birdcoder-commons/src/context/defaultIdeServicesLoader.ts',
);

assert.ok(
  !pathExists('packages/sdkwork-birdcoder-commons/src/shell.ts'),
  '@sdkwork/birdcoder-commons must not keep the legacy src/shell.ts barrel.',
);
assert.ok(
  !pathExists('packages/sdkwork-birdcoder-shell/src/legacy/LegacyBirdcoderApp.tsx'),
  '@sdkwork/birdcoder-shell must not keep the legacy root app bridge.',
);
assert.ok(
  !pathExists('packages/sdkwork-birdcoder-shell/src/runtime.ts'),
  '@sdkwork/birdcoder-shell must not retain runtime exports after the shell/runtime package split.',
);
assert.ok(
  !pathExists('packages/sdkwork-birdcoder-shell/src/application/bootstrap'),
  '@sdkwork/birdcoder-shell must not retain bootstrap runtime implementation files after the shell/runtime package split.',
);

assert.match(
  lazyDefaultIdeServicesSource,
  /import\(['"]\.\/defaultIdeServicesLoader\.ts['"]\)/u,
  '@sdkwork/birdcoder-commons lazyDefaultIdeServices must lazy-load the local loader bridge.',
);
assert.match(
  defaultIdeServicesLoaderSource,
  /from ['"]@sdkwork\/birdcoder-infrastructure['"]/u,
  '@sdkwork/birdcoder-commons defaultIdeServicesLoader must resolve BirdCoder IDE services from the infrastructure root entry.',
);

for (const relativePath of [
  'packages/sdkwork-birdcoder-web/src/main.tsx',
  'packages/sdkwork-birdcoder-desktop/src/main.tsx',
  'src/main.tsx',
]) {
  const source = readText(relativePath);
  assert.match(
    source,
    /from ['"]@sdkwork\/birdcoder-shell-runtime['"]/u,
    `${relativePath} must consume startup runtime helpers from the dedicated @sdkwork/birdcoder-shell-runtime entry.`,
  );
  assert.doesNotMatch(
    source,
    /from ['"]@sdkwork\/birdcoder-shell-runtime\/.+['"]/u,
    `${relativePath} must not import @sdkwork/birdcoder-shell-runtime package subpaths.`,
  );
}

for (const relativePath of [
  'packages/sdkwork-birdcoder-web/src/loadAppRoot.ts',
  'packages/sdkwork-birdcoder-desktop/src/main.tsx',
  'src/App.tsx',
]) {
  const source = readText(relativePath);
  const usesShellRootEntry =
    /from ['"]@sdkwork\/birdcoder-shell['"]/u.test(source) ||
    /import\(['"]@sdkwork\/birdcoder-shell['"]\)/u.test(source);
  assert.ok(
    usesShellRootEntry,
    `${relativePath} must consume application shell surfaces from the root @sdkwork/birdcoder-shell entry.`,
  );
  assert.doesNotMatch(
    source,
    /from ['"]@sdkwork\/birdcoder-shell\/.+['"]/u,
    `${relativePath} must not import @sdkwork/birdcoder-shell package subpaths.`,
  );
}

for (const relativePath of [
  'packages/sdkwork-birdcoder-web/src/main.tsx',
  'packages/sdkwork-birdcoder-web/src/App.tsx',
  'src/main.tsx',
]) {
  const source = readText(relativePath);
  assert.doesNotMatch(
    source,
    /from ['"]@sdkwork\/birdcoder-shell\/.+['"]/u,
    `${relativePath} must not import @sdkwork/birdcoder-shell package subpaths.`,
  );
  assert.doesNotMatch(
    source,
    /from ['"]@sdkwork\/birdcoder-shell-runtime\/.+['"]/u,
    `${relativePath} must not import @sdkwork/birdcoder-shell-runtime package subpaths.`,
  );
}

assert.ok(
  shellRootSource.includes("from './app';") &&
    !shellRootSource.includes('bootstrapShellRuntime') &&
    !shellRootSource.includes('waitForBirdCoderApiReady'),
  '@sdkwork/birdcoder-shell root entry must expose only the application shell surface.',
);
assert.ok(
  shellRuntimeRootSource.includes('bootstrapShellRuntime') &&
    shellRuntimeRootSource.includes('waitForBirdCoderApiReady') &&
    shellRuntimeRootSource.includes('BootstrapGate') &&
    !shellRuntimeRootSource.includes('AppRoot'),
  '@sdkwork/birdcoder-shell-runtime root entry must expose startup runtime helpers without re-exporting the application shell surface.',
);

for (const forbiddenStartupRuntimeDependency of [
  '@sdkwork/birdcoder-commons',
  '@sdkwork/birdcoder-workbench-storage',
  '@sdkwork/birdcoder-infrastructure',
  '@sdkwork/birdcoder-infrastructure-runtime',
]) {
  assert.doesNotMatch(
    shellRuntimeBootstrapServerBaseUrlSource,
    new RegExp(forbiddenStartupRuntimeDependency.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'),
    `bootstrapServerBaseUrl must not import ${forbiddenStartupRuntimeDependency}; startup URL resolution must stay independent from platform runtime chunks.`,
  );
}

console.log('commons shell entry contract passed.');
