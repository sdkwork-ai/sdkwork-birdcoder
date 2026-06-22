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

const shellRootSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/index.ts');
const shellRuntimeRootSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell-runtime/src/index.ts');
const shellRuntimeBootstrapServerBaseUrlSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapServerBaseUrl.ts',
);
const lazyDefaultIdeServicesSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/context/lazyDefaultIdeServices.ts',
);
const defaultIdeServicesLoaderSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/context/defaultIdeServicesLoader.ts',
);

assert.ok(
  !pathExists('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/shell.ts'),
  '@sdkwork/birdcoder-pc-commons must not keep the legacy src/shell.ts barrel.',
);
assert.ok(
  !pathExists('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/legacy/LegacyBirdcoderApp.tsx'),
  '@sdkwork/birdcoder-pc-shell must not keep the legacy root app bridge.',
);
assert.ok(
  !pathExists('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/runtime.ts'),
  '@sdkwork/birdcoder-pc-shell must not retain runtime exports after the shell/runtime package split.',
);
assert.ok(
  !pathExists('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/bootstrap'),
  '@sdkwork/birdcoder-pc-shell must not retain bootstrap runtime implementation files after the shell/runtime package split.',
);

assert.match(
  lazyDefaultIdeServicesSource,
  /import\(['"]\.\/defaultIdeServicesLoader\.ts['"]\)/u,
  '@sdkwork/birdcoder-pc-commons lazyDefaultIdeServices must lazy-load the local loader bridge.',
);
assert.match(
  defaultIdeServicesLoaderSource,
  /from ['"]@sdkwork\/birdcoder-pc-infrastructure['"]/u,
  '@sdkwork/birdcoder-pc-commons defaultIdeServicesLoader must resolve BirdCoder IDE services from the infrastructure root entry.',
);

for (const relativePath of [
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/src/main.tsx',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src/main.tsx',
  'apps/sdkwork-birdcoder-pc/src/main.tsx',
]) {
  const source = readText(relativePath);
  assert.match(
    source,
    /from ['"]@sdkwork\/birdcoder-pc-shell-runtime['"]/u,
    `${relativePath} must consume startup runtime helpers from the dedicated @sdkwork/birdcoder-pc-shell-runtime entry.`,
  );
  assert.doesNotMatch(
    source,
    /from ['"]@sdkwork\/birdcoder-pc-shell-runtime\/.+['"]/u,
    `${relativePath} must not import @sdkwork/birdcoder-pc-shell-runtime package subpaths.`,
  );
}

for (const relativePath of [
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/src/loadAppRoot.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src/main.tsx',
  'apps/sdkwork-birdcoder-pc/src/App.tsx',
]) {
  const source = readText(relativePath);
  const usesShellRootEntry =
    /from ['"]@sdkwork\/birdcoder-pc-shell['"]/u.test(source) ||
    /import\(['"]@sdkwork\/birdcoder-pc-shell['"]\)/u.test(source);
  assert.ok(
    usesShellRootEntry,
    `${relativePath} must consume application shell surfaces from the root @sdkwork/birdcoder-pc-shell entry.`,
  );
  assert.doesNotMatch(
    source,
    /from ['"]@sdkwork\/birdcoder-pc-shell\/.+['"]/u,
    `${relativePath} must not import @sdkwork/birdcoder-pc-shell package subpaths.`,
  );
}

for (const relativePath of [
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/src/main.tsx',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/src/App.tsx',
  'apps/sdkwork-birdcoder-pc/src/main.tsx',
]) {
  const source = readText(relativePath);
  assert.doesNotMatch(
    source,
    /from ['"]@sdkwork\/birdcoder-pc-shell\/.+['"]/u,
    `${relativePath} must not import @sdkwork/birdcoder-pc-shell package subpaths.`,
  );
  assert.doesNotMatch(
    source,
    /from ['"]@sdkwork\/birdcoder-pc-shell-runtime\/.+['"]/u,
    `${relativePath} must not import @sdkwork/birdcoder-pc-shell-runtime package subpaths.`,
  );
}

assert.ok(
  shellRootSource.includes("from './app';") &&
    shellRootSource.includes('ShellRuntimeProviders') &&
    !shellRootSource.includes('bootstrapShellRuntime') &&
    !shellRootSource.includes('waitForBirdCoderApiReady'),
  '@sdkwork/birdcoder-pc-shell root entry must expose only the application shell surface.',
);
assert.ok(
  shellRuntimeRootSource.includes('bootstrapShellRuntime') &&
    shellRuntimeRootSource.includes('waitForBirdCoderApiReady') &&
    shellRuntimeRootSource.includes('BootstrapGate') &&
    !shellRuntimeRootSource.includes('AppRoot'),
  '@sdkwork/birdcoder-pc-shell-runtime root entry must expose startup runtime helpers without re-exporting the application shell surface.',
);

for (const forbiddenStartupRuntimeDependency of [
  '@sdkwork/birdcoder-pc-commons',
  '@sdkwork/birdcoder-pc-workbench-storage',
  '@sdkwork/birdcoder-pc-infrastructure',
  '@sdkwork/birdcoder-pc-infrastructure-runtime',
]) {
  assert.doesNotMatch(
    shellRuntimeBootstrapServerBaseUrlSource,
    new RegExp(forbiddenStartupRuntimeDependency.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'),
    `bootstrapServerBaseUrl must not import ${forbiddenStartupRuntimeDependency}; startup URL resolution must stay independent from platform runtime chunks.`,
  );
}

console.log('commons shell entry contract passed.');
