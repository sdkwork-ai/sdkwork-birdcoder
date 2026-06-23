import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const corePrefix = 'apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_core/lib/src/bootstrap';
const rootPrefix = 'apps/sdkwork-birdcoder-flutter-mobile/lib';

const iamRuntimeSource = readText(`${corePrefix}/iam_runtime.dart`);
const sdkClientsSource = readText(`${corePrefix}/sdk_clients.dart`);
const environmentSource = readText(`${corePrefix}/environment.dart`);
const runtimeSource = readText(`${rootPrefix}/bootstrap/runtime.dart`);
const routesSource = readText(`${rootPrefix}/bootstrap/routes.dart`);
const mainSource = readText(`${rootPrefix}/main.dart`);
const appSource = readText(`${rootPrefix}/app.dart`);
const rootIamDelegateSource = readText(`${rootPrefix}/bootstrap/iam_runtime.dart`);

assert.match(
  rootIamDelegateSource,
  /sdkwork_birdcoder_flutter_mobile_core/u,
  'Flutter IAM bootstrap must delegate to the infrastructure-owned flutter mobile core runtime.',
);
assert.doesNotMatch(
  iamRuntimeSource,
  /initialized:\s*true/u,
  'Flutter IAM bootstrap must not keep placeholder stub state.',
);

assert.match(
  sdkClientsSource,
  /createBirdCoderAppSdkConsumer/u,
  'Flutter SDK bootstrap must compose app SDK clients through the consumer assembly package.',
);
assert.match(
  sdkClientsSource,
  /pendingGeneratedSdk/u,
  'Flutter SDK bootstrap must expose an explicit pending generated SDK marker.',
);
assert.doesNotMatch(
  sdkClientsSource,
  /appSdk:\s*null/u,
  'Flutter SDK bootstrap must not return null SDK clients.',
);

assert.match(
  environmentSource,
  /deploymentProfile/u,
  'Flutter environment bootstrap must expose deployment profile metadata.',
);
assert.match(
  runtimeSource,
  /resolveBirdCoderBootstrapServerBaseUrl/u,
  'Flutter runtime bootstrap must resolve the canonical server base URL.',
);
assert.match(
  routesSource,
  /createBirdCoderAuthRouteCatalog/u,
  'Flutter route bootstrap must include canonical IAM auth routes.',
);

assert.match(
  mainSource,
  /configureDefaultBirdCoderSessionStorage\(\)/u,
  'Flutter entrypoint must configure secure session storage before bootstrap.',
);
assert.match(
  mainSource,
  /BootstrapGate\([\s\S]*bootstrap:\s*bootstrapShellRuntime[\s\S]*builder:/u,
  'Flutter entrypoint must mount BootstrapGate and delegate runtime bootstrap before rendering the app shell.',
);

assert.match(
  appSource,
  /AppProvider\([\s\S]*AuthGate\(/u,
  'Flutter app shell must mount app context and IAM auth gate before product UI.',
);

console.log('flutter mobile root bootstrap contract passed.');
