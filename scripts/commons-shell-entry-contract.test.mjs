import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

const commonsPackageJson = readJson('packages/sdkwork-birdcoder-commons/package.json');
const shellPackageJson = readJson('packages/sdkwork-birdcoder-shell/package.json');

assert.ok(
  commonsPackageJson.exports?.['./shell'],
  '@sdkwork/birdcoder-commons must publish the ./shell subpath so the app shell can avoid the full commons barrel.',
);

assert.ok(
  shellPackageJson.exports?.['./app'],
  '@sdkwork/birdcoder-shell must publish the ./app subpath so delivery targets can consume the application shell without coupling to runtime bootstrap exports.',
);

assert.ok(
  shellPackageJson.exports?.['./runtime'],
  '@sdkwork/birdcoder-shell must publish the ./runtime subpath so delivery targets can bootstrap runtime wiring without coupling to the application shell facade.',
);

const shellEntrySource = readText('packages/sdkwork-birdcoder-commons/src/shell.ts');
const ideServicesSource = readText('packages/sdkwork-birdcoder-commons/src/context/ideServices.ts');
const ideProviderSource = readText('packages/sdkwork-birdcoder-commons/src/context/IDEContext.tsx');
const lazyDefaultIdeServicesSource = readText(
  'packages/sdkwork-birdcoder-commons/src/context/lazyDefaultIdeServices.ts',
);
const defaultIdeServicesLoaderSource = readText(
  'packages/sdkwork-birdcoder-commons/src/context/defaultIdeServicesLoader.ts',
);
const shellRootSource = readText('packages/sdkwork-birdcoder-shell/src/index.ts');
const shellBootstrapSource = readText(
  'packages/sdkwork-birdcoder-shell/src/application/bootstrap/bootstrapShellRuntime.ts',
);

assert.ok(
  !shellEntrySource.includes("export * from '@sdkwork/birdcoder-infrastructure';"),
  '@sdkwork/birdcoder-commons/shell must stay focused on app-shell providers and hooks instead of re-exporting the full infrastructure layer.',
);

assert.ok(
  !ideServicesSource.includes("from '../workbench/engines"),
  '@sdkwork/birdcoder-commons shell ideServices must not depend on workbench chat-engine factories because shell providers should not eagerly own chat runtime code.',
);

assert.ok(
  !ideServicesSource.includes('createDefaultBirdCoderIdeServices'),
  '@sdkwork/birdcoder-commons shell ideServices must not statically import createDefaultBirdCoderIdeServices because that eagerly binds the heavy infrastructure runtime into the app shell bundle.',
);
assert.doesNotMatch(
  lazyDefaultIdeServicesSource,
  /@sdkwork\/birdcoder-infrastructure\/services\/defaultIdeServices/u,
  '@sdkwork/birdcoder-commons lazyDefaultIdeServices must not directly import the infrastructure defaultIdeServices entry because that causes Vite to preload the heavy infrastructure assembly into the initial shell graph.',
);
assert.match(
  lazyDefaultIdeServicesSource,
  /import\(['"]\.\/defaultIdeServicesLoader\.ts['"]\)/u,
  '@sdkwork/birdcoder-commons lazyDefaultIdeServices must lazy-load a local defaultIdeServicesLoader bridge so the shell bundle does not directly bind the heavy infrastructure entry.',
);
assert.match(
  defaultIdeServicesLoaderSource,
  /@sdkwork\/birdcoder-infrastructure\/services\/defaultIdeServices/u,
  '@sdkwork/birdcoder-commons defaultIdeServicesLoader must own the infrastructure defaultIdeServices import so heavy service assembly stays behind a second-stage lazy boundary.',
);

assert.ok(
  !ideServicesSource.includes('chatEngine:') &&
    !ideServicesSource.includes('setChatEngine:') &&
    !ideServicesSource.includes('switchChatEngine:'),
  '@sdkwork/birdcoder-commons shell ideServices must not expose chat-engine state because chat runtime selection belongs to feature surfaces, not the app shell context.',
);

assert.ok(
  !ideProviderSource.includes("from '../workbench/engines") &&
    !ideProviderSource.includes('initialChatEngine') &&
    !ideProviderSource.includes('switchChatEngine') &&
    !ideProviderSource.includes('setChatEngine('),
  '@sdkwork/birdcoder-commons shell IDEProvider must not construct or switch chat engines because that pulls workbench kernels into the initial shell bundle.',
);
assert.doesNotMatch(
  ideProviderSource,
  /import\s*\{[\s\S]*?\}\s*from ['"]@sdkwork\/birdcoder-infrastructure['"]/u,
  '@sdkwork/birdcoder-commons shell IDEProvider must not keep runtime imports from the infrastructure root when it only needs interface types, otherwise the heavy infrastructure barrel becomes part of the initial shell graph.',
);
assert.match(
  ideProviderSource,
  /import\s+type\s*\{[\s\S]*?\}\s*from ['"]@sdkwork\/birdcoder-infrastructure['"]/u,
  '@sdkwork/birdcoder-commons shell IDEProvider must import infrastructure interfaces with import type so the shell bundle does not retain a runtime dependency on the infrastructure root barrel.',
);

assert.ok(
  !shellBootstrapSource.includes("from '@sdkwork/birdcoder-infrastructure';"),
  '@sdkwork/birdcoder-shell bootstrap must not import the full infrastructure root entry because runtime binding should come from a lightweight subpath.',
);

assert.match(
  shellBootstrapSource,
  /from ['"]@sdkwork\/birdcoder-infrastructure\/runtime\/defaultIdeServices['"]/u,
  '@sdkwork/birdcoder-shell bootstrap must consume bindDefaultBirdCoderIdeServicesRuntime from the lightweight infrastructure runtime subpath.',
);

assert.ok(
  !shellRootSource.includes('bootstrapShellRuntime'),
  '@sdkwork/birdcoder-shell root entry must stay app-focused and must not re-export bootstrapShellRuntime because delivery targets should consume runtime wiring from @sdkwork/birdcoder-shell/runtime.',
);

assert.match(
  readText('src/main.tsx'),
  /from ['"]@sdkwork\/birdcoder-commons\/shell['"]/u,
  'src/main.tsx must consume IDEProvider from @sdkwork/birdcoder-commons/shell.',
);

assert.match(
  readText('src/App.tsx'),
  /from ['"]@sdkwork\/birdcoder-commons\/shell['"]/u,
  'src/App.tsx must consume shell providers/hooks from @sdkwork/birdcoder-commons/shell.',
);

assert.match(
  readText('packages/sdkwork-birdcoder-web/src/main.tsx'),
  /from ['"]@sdkwork\/birdcoder-shell\/runtime['"]/u,
  'packages/sdkwork-birdcoder-web/src/main.tsx must consume bootstrapShellRuntime from @sdkwork/birdcoder-shell/runtime.',
);

assert.match(
  readText('packages/sdkwork-birdcoder-web/src/App.tsx'),
  /from ['"]@sdkwork\/birdcoder-shell\/app['"]/u,
  'packages/sdkwork-birdcoder-web/src/App.tsx must consume AppRoot from @sdkwork/birdcoder-shell/app.',
);

assert.match(
  readText('packages/sdkwork-birdcoder-desktop/src/main.tsx'),
  /from ['"]@sdkwork\/birdcoder-shell\/app['"]/u,
  'packages/sdkwork-birdcoder-desktop/src/main.tsx must consume AppRoot from @sdkwork/birdcoder-shell/app.',
);

assert.match(
  readText('packages/sdkwork-birdcoder-desktop/src/main.tsx'),
  /from ['"]@sdkwork\/birdcoder-shell\/runtime['"]/u,
  'packages/sdkwork-birdcoder-desktop/src/main.tsx must consume bootstrapShellRuntime from @sdkwork/birdcoder-shell/runtime.',
);

console.log('commons shell entry contract passed.');
