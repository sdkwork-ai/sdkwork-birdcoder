import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const iamRuntimeSource = readText('apps/sdkwork-birdcoder-pc/src/bootstrap/iamRuntime.ts');
const sdkClientsSource = readText('apps/sdkwork-birdcoder-pc/src/bootstrap/sdkClients.ts');
const environmentSource = readText('apps/sdkwork-birdcoder-pc/src/bootstrap/environment.ts');
const runtimeSource = readText('apps/sdkwork-birdcoder-pc/src/bootstrap/runtime.ts');
const routesSource = readText('apps/sdkwork-birdcoder-pc/src/bootstrap/routes.ts');

assert.match(
  iamRuntimeSource,
  /from ['"]@sdkwork\/birdcoder-pc-infrastructure\/services\/iamRuntime['"]/u,
  'Root IAM bootstrap must delegate to the infrastructure-owned appbase runtime.',
);
assert.doesNotMatch(
  iamRuntimeSource,
  /initialized:\s*true/u,
  'Root IAM bootstrap must not keep placeholder stub state.',
);

assert.match(
  sdkClientsSource,
  /createBirdCoderAppSdkClients/u,
  'Root SDK bootstrap must expose app-only SDK client composition.',
);
assert.match(
  sdkClientsSource,
  /getBirdCoderAppClient/u,
  'Root SDK bootstrap must construct the owner App SDK client through infrastructure composition.',
);
assert.doesNotMatch(
  sdkClientsSource,
  /getBirdCoderGeneratedBackendSdkClient/u,
  'Root SDK bootstrap must not eagerly construct backend SDK clients.',
);
assert.equal(
  fs.existsSync(path.join(rootDir, 'apps/sdkwork-birdcoder-pc/src/bootstrap/adminSdkClients.ts')),
  false,
  'PC root must not retain a BirdCoder Backend SDK bootstrap for a zero-operation authority.',
);
assert.doesNotMatch(
  sdkClientsSource,
  /appSdk:\s*null/u,
  'Root SDK bootstrap must not return null SDK clients.',
);

assert.match(
  environmentSource,
  /deploymentProfile/u,
  'Root environment bootstrap must expose deployment profile metadata.',
);
assert.match(
  runtimeSource,
  /resolveBirdCoderBootstrapServerBaseUrl/u,
  'Root runtime bootstrap must resolve the canonical server base URL.',
);
assert.match(
  routesSource,
  /createBirdCoderAuthRouteCatalog/u,
  'Root route bootstrap must include canonical IAM auth routes.',
);

console.log('pc root bootstrap contract passed.');
