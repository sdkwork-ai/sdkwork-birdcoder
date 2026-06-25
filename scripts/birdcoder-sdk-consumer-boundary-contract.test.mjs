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

function assertNoRetiredGenericSdkDebt(relativePath) {
  const source = read(relativePath);
  const retiredFragments = [
    ['@sdkwork/', 'app-sdk'].join(''),
    ['@sdkwork/', 'backend-sdk'].join(''),
    ['sdkwork-', 'app-sdk'].join(''),
    ['sdkwork-', 'backend-sdk'].join(''),
    ['spring-ai-plus-', 'app-api'].join(''),
    ['spring-ai-plus-', 'backend-api'].join(''),
  ];
  assert.doesNotMatch(
    source,
    new RegExp(retiredFragments.join('|'), 'u'),
    `${relativePath} must not reference the retired generic Spring app/backend SDK family.`,
  );
}

function assertNotExists(relativePath, message) {
  assert.equal(
    fs.existsSync(path.join(rootDir, relativePath)),
    false,
    message ?? `${relativePath} must not exist.`,
  );
}

const infrastructurePackageJson = JSON.parse(
  read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/package.json'),
);
const tsconfig = JSON.parse(read('tsconfig.json'));
const runtimeTsconfig = JSON.parse(read('tsconfig.runtime.json'));

assertNotExists(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appAdminApiClient.ts',
  'BirdCoder infrastructure must not keep the retired mixed app-admin API client.',
);

assertExists(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts',
  'BirdCoder infrastructure must expose one sdkClients.ts boundary for generated app/backend SDK construction.',
);
assertExists(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSdkTransport.ts',
  'BirdCoder infrastructure must expose app SDK transport separately from backend SDK transport.',
);
assertExists(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/backendSdkTransport.ts',
  'BirdCoder infrastructure must expose backend SDK transport separately from app SDK transport.',
);

const sdkClientsSource = read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts');
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

const infrastructureIndexSource = read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/index.ts');
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
  read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts'),
  read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesShared.ts'),
  read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesRuntime.ts'),
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
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl',
);
for (const entry of fs.readdirSync(serviceImplDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.ts')) {
    continue;
  }

  const relativePath = `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/${entry.name}`;
  const source = read(relativePath);
  assert.doesNotMatch(
    source,
    /BirdCoderAppAdminApiClient|appAdminClient|createBirdCoderGeneratedAppAdminApiClient/u,
    `${relativePath} must not depend on the retired mixed app-admin client type.`,
  );
}

const serverApiSource = read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/server-api.ts');
assert.doesNotMatch(
  serverApiSource,
  /BirdCoderAppAdminApiClient|createBirdCoderGeneratedAppAdminApiClient|CreateBirdCoderGeneratedAppAdminApiClientOptions/u,
  'types/server-api.ts must not export the retired generated app-admin facade.',
);

assert.equal(
  infrastructurePackageJson.dependencies?.['@sdkwork/birdcoder-pc-app-sdk'],
  'workspace:*',
  'infrastructure package must depend on the generated app SDK workspace package.',
);
assert.equal(
  infrastructurePackageJson.dependencies?.['@sdkwork/birdcoder-pc-backend-sdk'],
  'workspace:*',
  'infrastructure package must depend on the generated backend SDK workspace package.',
);
for (const dependencyName of [
  '@sdkwork/iam-app-sdk',
  '@sdkwork/iam-backend-sdk',
  '@sdkwork/auth-runtime-pc-react',
  '@sdkwork/drive-app-sdk',
  '@sdkwork/messaging-app-sdk',
  '@sdkwork/sdk-common',
]) {
  assert.equal(
    infrastructurePackageJson.dependencies?.[dependencyName],
    'workspace:*',
    `infrastructure package must depend on ${dependencyName} for standard dependency SDK composition.`,
  );
}

for (const [label, config] of [
  ['tsconfig.json', tsconfig],
  ['tsconfig.runtime.json', runtimeTsconfig],
]) {
  assert.deepEqual(
    config.compilerOptions?.paths?.['@sdkwork/birdcoder-pc-app-sdk'],
    ['sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript/src/index.ts'],
    `${label} must resolve @sdkwork/birdcoder-pc-app-sdk to generated source.`,
  );
  assert.deepEqual(
    config.compilerOptions?.paths?.['@sdkwork/birdcoder-pc-backend-sdk'],
    ['sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-typescript/src/index.ts'],
    `${label} must resolve @sdkwork/birdcoder-pc-backend-sdk to generated source.`,
  );
  assert.deepEqual(
    config.compilerOptions?.paths?.['@sdkwork/iam-app-sdk'],
    ['../sdkwork-iam/sdks/sdkwork-iam-app-sdk/sdkwork-iam-app-sdk-typescript/generated/server-openapi/src/index.ts'],
    `${label} must resolve @sdkwork/iam-app-sdk to the dependency generated app SDK package entry.`,
  );
  assert.deepEqual(
    config.compilerOptions?.paths?.['@sdkwork/iam-backend-sdk'],
    ['../sdkwork-iam/sdks/sdkwork-iam-backend-sdk/sdkwork-iam-backend-sdk-typescript/generated/server-openapi/src/index.ts'],
    `${label} must resolve @sdkwork/iam-backend-sdk to the dependency generated backend SDK package entry.`,
  );
  assert.deepEqual(
    config.compilerOptions?.paths?.['@sdkwork/auth-runtime-pc-react'],
    ['../sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/index.ts'],
    `${label} must resolve @sdkwork/auth-runtime-pc-react to the high-level appbase auth runtime package entry.`,
  );
  assert.deepEqual(
    config.compilerOptions?.paths?.['@sdkwork/drive-app-sdk'],
    ['../sdkwork-drive/sdks/sdkwork-drive-app-sdk/sdkwork-drive-app-sdk-typescript/src/index.ts'],
    `${label} must resolve @sdkwork/drive-app-sdk to the dependency app SDK package entry.`,
  );
  assert.deepEqual(
    config.compilerOptions?.paths?.['@sdkwork/messaging-app-sdk'],
    ['../sdkwork-messaging/sdks/sdkwork-messaging-app-sdk/sdkwork-messaging-app-sdk-typescript/generated/server-openapi/src/index.ts'],
    `${label} must resolve @sdkwork/messaging-app-sdk to the dependency app SDK package entry.`,
  );
  assert.deepEqual(
    config.compilerOptions?.paths?.['@sdkwork/sdk-common'],
    ['../sdkwork-sdk-commons/sdkwork-sdk-common-typescript/src/index.ts'],
    `${label} must resolve @sdkwork/sdk-common to the shared SDK common package entry.`,
  );
}

for (const relativePath of [
  'tsconfig.json',
  'tsconfig.runtime.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/vite.config.ts',
  'scripts/create-birdcoder-vite-plugins.mjs',
  'scripts/prepare-shared-sdk-git-sources.mjs',
  'scripts/prepare-shared-sdk-git-sources.test.mjs',
  'scripts/run-desktop-vite-host.test.mjs',
  'scripts/vite-config-esm-contract.test.mjs',
]) {
  assertNoRetiredGenericSdkDebt(relativePath);
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
assert.match(
  workspace,
  /\.\.\/sdkwork-iam\/sdks\/sdkwork-iam-app-sdk\/sdkwork-iam-app-sdk-typescript\/generated\/server-openapi/u,
  'pnpm workspace must include the IAM app SDK dependency package.',
);
assert.match(
  workspace,
  /\.\.\/sdkwork-iam\/sdks\/sdkwork-iam-backend-sdk\/sdkwork-iam-backend-sdk-typescript\/generated\/server-openapi/u,
  'pnpm workspace must include the IAM backend SDK dependency package.',
);
assert.match(
  workspace,
  /\.\.\/sdkwork-iam\/apps\/sdkwork-iam-pc\/packages\/sdkwork-auth-runtime-pc-react/u,
  'pnpm workspace must include the IAM high-level auth runtime dependency package.',
);
assert.match(
  workspace,
  /\.\.\/sdkwork-drive\/sdks\/sdkwork-drive-app-sdk\/sdkwork-drive-app-sdk-typescript/u,
  'pnpm workspace must include the Drive app SDK dependency package.',
);
assert.match(
  workspace,
  /\.\.\/sdkwork-messaging\/sdks\/sdkwork-messaging-app-sdk\/sdkwork-messaging-app-sdk-typescript\/generated\/server-openapi/u,
  'pnpm workspace must include the Messaging app SDK dependency package.',
);
assert.match(
  workspace,
  /\.\.\/sdkwork-sdk-commons\/sdkwork-sdk-common-typescript/u,
  'pnpm workspace must include the shared SDK common dependency package.',
);

const vitePluginSource = read('scripts/create-birdcoder-vite-plugins.mjs');
for (const dependencySpecifier of [
  '@sdkwork/iam-app-sdk',
  '@sdkwork/iam-backend-sdk',
  '@sdkwork/auth-runtime-pc-react',
  '@sdkwork/drive-app-sdk',
  '@sdkwork/messaging-app-sdk',
  '@sdkwork/sdk-common',
]) {
  assert.match(
    vitePluginSource,
    new RegExp(`find:\\s*['"]${dependencySpecifier.replace('/', '\\/')}['"]`, 'u'),
    `BirdCoder Vite aliases must resolve ${dependencySpecifier}.`,
  );
}

console.log('birdcoder SDK consumer boundary contract passed.');
