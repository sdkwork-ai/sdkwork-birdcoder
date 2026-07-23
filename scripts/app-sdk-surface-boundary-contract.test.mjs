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

const serviceSources = [
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesShared.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesRuntime.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/lazyDefaultIdeServices.ts',
].map(readText).join('\n');

assert.doesNotMatch(
  serviceSources,
  /BirdCoderBackendSdk|backendClient|hasExplicitBackendClient|ApiBackedAdmin|adminDeploymentService|createUnavailableAdmin|createUnavailableAuditService|createUnavailableReleaseService/u,
  'App services must not retain hidden Backend SDK or unavailable admin-service paths.',
);

const appSdkBootstrap = readText('apps/sdkwork-birdcoder-pc/src/bootstrap/sdkClients.ts');
assert.match(appSdkBootstrap, /getBirdCoderAppClient/u);
assert.doesNotMatch(appSdkBootstrap, /BackendSdk|backendClient|adminSdk/u);

const workbenchContext = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/context/ideServices.ts',
);
assert.doesNotMatch(
  workbenchContext,
  /adminDeploymentService|adminPolicyService|auditService/u,
  'The app workbench context must not expose internal-admin services.',
);

for (const retiredPath of [
  'apps/sdkwork-birdcoder-pc/src/bootstrap/adminSdkClients.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-admin-core/src/sdk/backendSdkApiClient.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-admin-core/src/sdk/backendGeneratedSdkClient.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/backendSdkTransport.ts',
  'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-core/src/sdk/birdcoderBackendClient.ts',
  'apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_core/lib/src/sdk/birdcoder_admin_backend_client.dart',
]) {
  assert.equal(fs.existsSync(absolutePath(retiredPath)), false, `${retiredPath} must remain deleted.`);
}

console.log('BirdCoder App-only surface boundary contract passed.');
