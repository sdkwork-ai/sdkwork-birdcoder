import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const defaultIdeServicesSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts',
);
const lazyDefaultIdeServicesSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/lazyDefaultIdeServices.ts',
);
const defaultIdeServicesSharedSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesShared.ts',
);
const rootSdkClientsSource = readText('apps/sdkwork-birdcoder-pc/src/bootstrap/sdkClients.ts');

assert.match(
  defaultIdeServicesSource,
  /createUnavailableAdminDeploymentService|hasExplicitBackendClient/u,
  'Default IDE services must not eagerly wire admin deployment services without explicit backend client binding.',
);
assert.doesNotMatch(
  defaultIdeServicesSource,
  /new ApiBackedAdminDeploymentService/u,
  'Default IDE services must not construct ApiBackedAdminDeploymentService directly.',
);
assert.match(
  lazyDefaultIdeServicesSource,
  /hasExplicitBackendClient/u,
  'Lazy IDE services must gate admin services behind explicit backend client binding.',
);
assert.match(
  defaultIdeServicesSharedSource,
  /hasExplicitBackendClient[\s\S]*createUnavailableBirdCoderBackendClient/u,
  'Shared IDE runtime must use unavailable backend clients unless explicitly bound.',
);
assert.doesNotMatch(
  rootSdkClientsSource,
  /getBirdCoderGeneratedBackendSdkClient/u,
  'PC root bootstrap must not eagerly construct backend SDK clients.',
);

const commonsIdeServicesSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/context/ideServices.ts',
);
assert.doesNotMatch(
  commonsIdeServicesSource,
  /adminDeploymentService|adminPolicyService|auditService/u,
  'pc-commons IDE context must not expose admin/backend services to the app shell.',
);

const appRuntimeTransportSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appRuntimeTransport.ts',
);
assert.doesNotMatch(
  appRuntimeTransportSource,
  /from ['"]@sdkwork\/birdcoder-backend-sdk['"]/u,
  'App runtime transport must not import backend SDK catalogs.',
);

const h5CorePackage = JSON.parse(
  readText('apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-core/package.json'),
);
assert.match(
  lazyDefaultIdeServicesSource,
  /createUnavailableAdminDeploymentService/u,
  'Lazy IDE services must expose unavailable admin stubs for app runtime.',
);
assert.match(
  lazyDefaultIdeServicesSource,
  /createUnavailableReleaseService/u,
  'Lazy IDE services must expose unavailable release stubs for app runtime.',
);
assert.match(
  defaultIdeServicesSource,
  /createUnavailableReleaseService|ApiBackedReleaseService/u,
  'Default IDE services must gate release inventory behind explicit backend client binding.',
);
assert.equal(
  h5CorePackage.dependencies?.['@sdkwork/birdcoder-h5-chat'],
  undefined,
  'h5-core must not depend on h5-chat; route catalog belongs in h5-shell.',
);

const adminCoreBackendSdkSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-admin-core/src/sdk/backendSdkApiClient.ts',
);
const adminCoreGeneratedBackendSdkSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-admin-core/src/sdk/backendGeneratedSdkClient.ts',
);
const infrastructureSdkClientsSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts',
);
const adminSdkClientsSource = readText('apps/sdkwork-birdcoder-pc/src/bootstrap/adminSdkClients.ts');

assert.match(
  adminCoreBackendSdkSource,
  /createBirdCoderBackendSdkApiClient/u,
  'Admin core must own backend SDK API client composition.',
);
assert.match(
  adminCoreGeneratedBackendSdkSource,
  /createBirdCoderGeneratedBackendSdkClient/u,
  'Admin core must own generated backend SDK client composition.',
);
assert.doesNotMatch(
  infrastructureSdkClientsSource,
  /export function createBirdCoderBackendSdkApiClient/u,
  'Infrastructure must re-export backend SDK API client from admin-core instead of defining it.',
);
assert.doesNotMatch(
  infrastructureSdkClientsSource,
  /export function createBirdCoderGeneratedBackendSdkClient/u,
  'Infrastructure must re-export generated backend SDK client from admin-core instead of defining it.',
);
assert.match(
  infrastructureSdkClientsSource,
  /registerBirdCoderBackendSdkTransportResolver/u,
  'Infrastructure must register backend SDK transport resolver for admin-core generated clients.',
);
assert.match(
  adminSdkClientsSource,
  /@sdkwork\/birdcoder-pc-admin-core/u,
  'PC admin bootstrap must import backend SDK clients from admin-core.',
);

console.log('app sdk surface boundary contract passed.');
