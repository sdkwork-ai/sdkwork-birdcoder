import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function assertExists(relativePath, message) {
  assert.ok(fs.existsSync(path.join(rootDir, relativePath)), message ?? `${relativePath} must exist.`);
}

function assertNotExists(relativePath, message) {
  assert.equal(
    fs.existsSync(path.join(rootDir, relativePath)),
    false,
    message ?? `${relativePath} must not exist.`,
  );
}

const infrastructurePackageJson = JSON.parse(
  read('packages/sdkwork-birdcoder-infrastructure/package.json'),
);
const tsconfig = JSON.parse(read('tsconfig.json'));
const runtimeTsconfig = JSON.parse(read('tsconfig.runtime.json'));

assertNotExists(
  'packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts',
  'BirdCoder infrastructure must not keep the retired mixed app-admin API client.',
);

assertExists(
  'packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts',
  'BirdCoder infrastructure must expose one sdkClients.ts boundary for generated app/backend SDK construction.',
);
assertExists(
  'packages/sdkwork-birdcoder-infrastructure/src/services/appSdkTransport.ts',
  'BirdCoder infrastructure must expose app SDK transport separately from backend SDK transport.',
);
assertExists(
  'packages/sdkwork-birdcoder-infrastructure/src/services/backendSdkTransport.ts',
  'BirdCoder infrastructure must expose backend SDK transport separately from app SDK transport.',
);

const sdkClientsSource = read('packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts');
assert.match(
  sdkClientsSource,
  /from ['"]@sdkwork\/birdcoder-app-sdk['"]/u,
  'sdkClients.ts must import the generated BirdCoder app SDK package.',
);
assert.match(
  sdkClientsSource,
  /from ['"]@sdkwork\/birdcoder-backend-sdk['"]/u,
  'sdkClients.ts must import the generated BirdCoder backend SDK package.',
);
assert.match(
  sdkClientsSource,
  /\bcreateBirdcoderAppSdkClient\b/u,
  'sdkClients.ts must construct the generated app SDK client.',
);
assert.match(
  sdkClientsSource,
  /\bcreateBirdcoderBackendSdkClient\b/u,
  'sdkClients.ts must construct the generated backend SDK client.',
);
assert.doesNotMatch(
  sdkClientsSource,
  /BirdCoderAppAdminApiClient|createBirdCoderGeneratedAppAdminApiClient|CreateBirdCoderGeneratedAppAdminApiClientOptions|appAdminClient/u,
  'sdkClients.ts must not reintroduce the retired app-admin facade naming.',
);
assert.doesNotMatch(
  sdkClientsSource,
  /\b(?:BirdCoderSplitSdkApiClients|CreateBirdCoderSplitSdkApiClientsOptions|createBirdCoderSplitSdkApiClients)\b/u,
  'sdkClients.ts must not publish a mixed split-SDK wrapper; consumers must compose app and backend SDK clients explicitly.',
);

const infrastructureIndexSource = read('packages/sdkwork-birdcoder-infrastructure/src/index.ts');
assert.doesNotMatch(
  infrastructureIndexSource,
  /appAdminApiClient/u,
  'infrastructure public index must not export the retired appAdminApiClient module.',
);
assert.match(
  infrastructureIndexSource,
  /services\/sdkClients\.ts/u,
  'infrastructure public index must export the SDK boundary.',
);

const defaultServicesSource = [
  read('packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts'),
  read('packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServicesShared.ts'),
  read('packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServicesRuntime.ts'),
].join('\n');
assert.doesNotMatch(
  defaultServicesSource,
  /appAdminClient|BirdCoderAppAdminApiClient|createBirdCoderGeneratedAppAdminApiClient/u,
  'default IDE service bootstrap must not use retired app-admin client naming.',
);
assert.match(
  defaultServicesSource,
  /\bappClient\b/u,
  'default IDE service bootstrap must keep a distinct app SDK client binding.',
);
assert.match(
  defaultServicesSource,
  /\bbackendClient\b/u,
  'default IDE service bootstrap must keep a distinct backend SDK client binding.',
);

const serviceImplDir = path.join(
  rootDir,
  'packages/sdkwork-birdcoder-infrastructure/src/services/impl',
);
for (const entry of fs.readdirSync(serviceImplDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.ts')) {
    continue;
  }

  const relativePath = `packages/sdkwork-birdcoder-infrastructure/src/services/impl/${entry.name}`;
  const source = read(relativePath);
  assert.doesNotMatch(
    source,
    /BirdCoderAppAdminApiClient|appAdminClient|createBirdCoderGeneratedAppAdminApiClient/u,
    `${relativePath} must not depend on the retired mixed app-admin client type.`,
  );
}

const serverApiSource = read('packages/sdkwork-birdcoder-types/src/server-api.ts');
assert.doesNotMatch(
  serverApiSource,
  /BirdCoderAppAdminApiClient|createBirdCoderGeneratedAppAdminApiClient|CreateBirdCoderGeneratedAppAdminApiClientOptions/u,
  'types/server-api.ts must not export the retired generated app-admin facade.',
);

assert.equal(
  infrastructurePackageJson.dependencies?.['@sdkwork/birdcoder-app-sdk'],
  'workspace:*',
  'infrastructure package must depend on the generated app SDK workspace package.',
);
assert.equal(
  infrastructurePackageJson.dependencies?.['@sdkwork/birdcoder-backend-sdk'],
  'workspace:*',
  'infrastructure package must depend on the generated backend SDK workspace package.',
);

for (const [label, config] of [
  ['tsconfig.json', tsconfig],
  ['tsconfig.runtime.json', runtimeTsconfig],
]) {
  assert.deepEqual(
    config.compilerOptions?.paths?.['@sdkwork/birdcoder-app-sdk'],
    ['sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript/src/index.ts'],
    `${label} must resolve @sdkwork/birdcoder-app-sdk to generated source.`,
  );
  assert.deepEqual(
    config.compilerOptions?.paths?.['@sdkwork/birdcoder-backend-sdk'],
    ['sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-typescript/src/index.ts'],
    `${label} must resolve @sdkwork/birdcoder-backend-sdk to generated source.`,
  );
}

const workspace = read('pnpm-workspace.yaml');
assert.match(
  workspace,
  /sdks\/sdkwork-birdcoder-app-sdk\/sdkwork-birdcoder-app-sdk-typescript/u,
  'pnpm workspace must include the generated app SDK TypeScript package.',
);
assert.match(
  workspace,
  /sdks\/sdkwork-birdcoder-backend-sdk\/sdkwork-birdcoder-backend-sdk-typescript/u,
  'pnpm workspace must include the generated backend SDK TypeScript package.',
);

console.log('birdcoder SDK consumer boundary contract passed.');
