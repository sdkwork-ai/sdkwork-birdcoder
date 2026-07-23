import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const corePrefix = 'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-core/src';
const shellPrefix = 'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-shell/src';
const rootPrefix = 'apps/sdkwork-birdcoder-h5/src';

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const iamRuntimeSource = readText(`${corePrefix}/bootstrap/iamRuntime.ts`);
const appSdkSource = readText(`${corePrefix}/sdk/appSdkClient.ts`);
const environmentSource = readText(`${corePrefix}/bootstrap/environment.ts`);
const runtimeSource = readText(`${rootPrefix}/bootstrap/runtime.ts`);
const routesSource = readText(`${shellPrefix}/routes/routeCatalog.ts`);
const sdkClientsSource = readText(`${rootPrefix}/bootstrap/sdkClients.ts`);
const mainSource = readText(`${rootPrefix}/main.tsx`);
const appSource = readText(`${rootPrefix}/App.tsx`);

assert.match(
  iamRuntimeSource,
  /from ['"]@sdkwork\/auth-runtime-pc-react\/appbasePcAuthRuntime['"]/u,
  'H5 IAM bootstrap must consume the canonical high-level appbase auth runtime.',
);
assert.match(
  iamRuntimeSource,
  /createSdkworkAppbasePcAuthRuntime\(\{/u,
  'H5 IAM bootstrap must compose the high-level appbase auth runtime.',
);
assert.doesNotMatch(
  iamRuntimeSource,
  /initialized:\s*true/u,
  'H5 IAM bootstrap must not keep placeholder stub state.',
);

assert.match(
  appSdkSource,
  /from ['"]@sdkwork\/birdcoder-app-sdk['"]/u,
  'H5 core must construct the owner App SDK through its composed package.',
);
assert.match(
  appSdkSource,
  /tokenManager:\s*getBirdCoderGlobalTokenManager\(\)/u,
  'H5 App SDK must share the global TokenManager.',
);

assert.match(
  sdkClientsSource,
  /createBirdCoderH5AppSdkClient/u,
  'H5 root SDK bootstrap must compose app SDK clients through h5-core.',
);
assert.doesNotMatch(
  sdkClientsSource,
  /BackendSdk|backendSdk|birdcoder-backend-sdk/u,
  'H5 root must not construct the nonexistent BirdCoder Backend SDK.',
);

assert.match(
  environmentSource,
  /deploymentProfile/u,
  'H5 environment bootstrap must expose deployment profile metadata.',
);
assert.match(
  runtimeSource,
  /resolveBirdCoderBootstrapServerBaseUrl/u,
  'H5 runtime bootstrap must resolve the canonical server base URL.',
);
assert.match(
  routesSource,
  /createBirdCoderAuthRouteCatalog/u,
  'H5 route catalog must include canonical IAM auth routes in h5-shell.',
);

assert.match(
  mainSource,
  /<BootstrapGate bootstrap=\{createBirdCoderH5BootstrapRuntime\} messages=\{createBootstrapGateMessages\(\)\}>[\s\S]*<App \/>/u,
  'H5 entrypoint must mount BootstrapGate and delegate runtime bootstrap before rendering the app shell.',
);

assert.match(
  mainSource,
  /registerBirdCoderHostAdapters\(\)/u,
  'H5 entrypoint must register host adapters before bootstrap.',
);

assert.match(
  readText('apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-shell/src/bootstrap/createBootstrapRuntime.ts'),
  /hydrateBirdCoderH5AppSessionPersistence/u,
  'H5 shell bootstrap must hydrate IAM session persistence.',
);

assert.match(
  mainSource,
  /from ['"]@sdkwork\/birdcoder-h5-shell['"]/u,
  'H5 entrypoint must bootstrap through the h5-shell package boundary.',
);

assert.match(
  appSource,
  /<ShellRuntimeProviders>[\s\S]*<BirdCoderAuthGate>[\s\S]*<AppProvider>/u,
  'H5 app shell must mount runtime providers, IAM auth gate, and app context before product UI.',
);

console.log('h5 root bootstrap contract passed.');
