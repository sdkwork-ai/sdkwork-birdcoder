import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const iamRuntimeSource = readText('apps/sdkwork-birdcoder-h5/src/bootstrap/iamRuntime.ts');
const sdkClientsSource = readText('apps/sdkwork-birdcoder-h5/src/bootstrap/sdkClients.ts');
const environmentSource = readText('apps/sdkwork-birdcoder-h5/src/bootstrap/environment.ts');
const runtimeSource = readText('apps/sdkwork-birdcoder-h5/src/bootstrap/runtime.ts');
const routesSource = readText('apps/sdkwork-birdcoder-h5/src/bootstrap/routes.ts');

assert.match(
  iamRuntimeSource,
  /from ['"]@sdkwork\/birdcoder-pc-infrastructure['"]/u,
  'H5 IAM bootstrap must delegate to the infrastructure-owned appbase runtime.',
);
assert.doesNotMatch(
  iamRuntimeSource,
  /initialized:\s*true/u,
  'H5 IAM bootstrap must not keep placeholder stub state.',
);

assert.match(
  sdkClientsSource,
  /getBirdCoderGeneratedAppSdkClient/u,
  'H5 SDK bootstrap must construct generated app SDK clients.',
);
assert.match(
  sdkClientsSource,
  /getBirdCoderGeneratedBackendSdkClient/u,
  'H5 SDK bootstrap must construct generated backend SDK clients.',
);
assert.doesNotMatch(
  sdkClientsSource,
  /appSdk:\s*null/u,
  'H5 SDK bootstrap must not return null SDK clients.',
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
  'H5 route bootstrap must include canonical IAM auth routes.',
);

console.log('h5 root bootstrap contract passed.');
