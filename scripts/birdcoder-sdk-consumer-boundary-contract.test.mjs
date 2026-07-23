import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function absolutePath(relativePath) {
  return path.join(rootDir, ...relativePath.split('/'));
}

function readText(relativePath) {
  return fs.readFileSync(absolutePath(relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function walkFiles(relativeRoot, predicate) {
  const files = [];
  const root = absolutePath(relativeRoot);
  if (!fs.existsSync(root)) return files;
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'target') continue;
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(child);
      else if (predicate(child)) files.push(child);
    }
  }
  return files;
}

const appSdkEntry = 'sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript/src/index.ts';
for (const [relativePath, expectedAlias] of [
  ['tsconfig.json', appSdkEntry],
  ['tsconfig.runtime.json', appSdkEntry],
  ['apps/sdkwork-birdcoder-pc/tsconfig.json', '../../' + appSdkEntry],
  ['apps/sdkwork-birdcoder-pc/tsconfig.runtime.json', '../../' + appSdkEntry],
]) {
  const config = readJson(relativePath);
  assert.deepEqual(
    config.compilerOptions?.paths?.['@sdkwork/birdcoder-app-sdk'],
    [expectedAlias],
    `${relativePath} must resolve the application-root App SDK facade.`,
  );
  assert.equal(
    config.compilerOptions?.paths?.['@sdkwork/birdcoder-backend-sdk'],
    undefined,
    `${relativePath} must not resolve a nonexistent BirdCoder Backend SDK.`,
  );
}

const workspace = readText('pnpm-workspace.yaml');
assert.match(
  workspace,
  /sdks\/sdkwork-birdcoder-app-sdk\/sdkwork-birdcoder-app-sdk-typescript/u,
  'pnpm workspace must expose the application-root App SDK facade.',
);
assert.doesNotMatch(workspace, /apps\/sdkwork-birdcoder-pc\/sdks/u);
assert.doesNotMatch(workspace, /sdkwork-birdcoder-backend-sdk/u);

const pcCoreSdkEntry = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-core/src/sdk/birdcoder-app-sdk.ts',
);
assert.match(pcCoreSdkEntry, /export \* from ['"]@sdkwork\/birdcoder-app-sdk['"]/u);

const pcSdkClients = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/birdCoderSdkClient.ts',
);
assert.match(pcSdkClients, /\bcreateBirdCoderAppClient\b/u);
assert.match(pcSdkClients, /@sdkwork\/birdcoder-pc-core\/sdk\/birdcoder-app/u);
assert.doesNotMatch(pcSdkClients, /BirdCoderBackendSdk|birdcoder-backend-sdk|backendSdkTransport/u);

const pcBootstrap = readText('apps/sdkwork-birdcoder-pc/src/bootstrap/sdkClients.ts');
assert.match(pcBootstrap, /getBirdCoderAppClient/u);
assert.doesNotMatch(pcBootstrap, /BackendSdk|backendSdk|adminSdkClients/u);

const forbiddenBackendPattern = /@sdkwork\/birdcoder-backend-sdk|sdkwork-birdcoder-backend-sdk|BirdCoderBackendSdk/u;
for (const file of walkFiles('apps', (filePath) => /\.(?:json|ts|tsx|yaml|yml)$/u.test(filePath))) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(
    source,
    forbiddenBackendPattern,
    `${path.relative(rootDir, file)} must not consume a nonexistent BirdCoder Backend SDK.`,
  );
}

for (const retiredPath of [
  'apps/sdkwork-birdcoder-pc/src/bootstrap/adminSdkClients.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-admin-core/src/sdk/backendSdkApiClient.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-admin-core/src/sdk/backendGeneratedSdkClient.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/backendSdkTransport.ts',
]) {
  assert.equal(fs.existsSync(absolutePath(retiredPath)), false, `${retiredPath} must remain deleted.`);
}

console.log('BirdCoder App-only SDK consumer boundary contract passed.');
