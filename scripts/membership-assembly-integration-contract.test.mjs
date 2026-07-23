import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const assemblyCargo = read('crates/sdkwork-api-birdcoder-assembly/Cargo.toml');
const assemblyBootstrap = read('crates/sdkwork-api-birdcoder-assembly/src/bootstrap.rs');
const topologySpec = JSON.parse(read('specs/topology.spec.json'));
assert.doesNotMatch(
  assemblyBootstrap,
  /sdkwork_api_membership_assembly|foundation[_-]membership/u,
  'BirdCoder application assembly must not mount the dependency-owned Membership API.',
);
assert.doesNotMatch(
  assemblyCargo,
  /sdkwork-api-membership-assembly|foundation-membership/u,
  'BirdCoder application assembly must not depend on the Membership assembly.',
);
const standaloneProcesses = topologySpec.orchestration.profiles['standalone.development'].processes;
assert.deepEqual(
  standaloneProcesses
    .filter((processDefinition) => processDefinition.role === 'api-standalone-gateway')
    .map((processDefinition) => processDefinition.binary),
  ['sdkwork-api-birdcoder-standalone-gateway'],
);
assert.equal(
  standaloneProcesses.some(
    (processDefinition) => /membership|platform-gateway/u.test(processDefinition.id),
  ),
  false,
  'BirdCoder must not supervise or embed a Membership gateway; the client uses platform.api-gateway.',
);

const membershipBootstrap = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/membershipSdkBootstrap.ts',
);
assert.match(membershipBootstrap, /VITE_SDKWORK_MEMBERSHIP_APP_API_BASE_URL/u);
assert.match(membershipBootstrap, /VITE_SDKWORK_ORDER_APP_API_BASE_URL/u);
assert.match(membershipBootstrap, /resolveBirdCoderDependencySdkBaseUrl/u);
assert.match(membershipBootstrap, /bootstrapSdkworkMembershipAppService/u);
assert.match(membershipBootstrap, /getBirdCoderGlobalTokenManager/u);
assert.match(membershipBootstrap, /runtimeConfig\.platformApiGatewayBaseUrl/u);
assert.doesNotMatch(membershipBootstrap, /runtimeConfig\.applicationApiBaseUrl|return false/u);

const adminClient = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-admin-core/src/sdk/membershipBackendSdkClient.ts',
);
assert.match(adminClient, /from '@sdkwork\/membership-backend-sdk'/u);
assert.match(adminClient, /authMode: 'dual-token'/u);
assert.match(adminClient, /getBirdCoderGlobalTokenManager/u);
assert.doesNotMatch(adminClient, /fetch\(|axios|Authorization|Access-Token/u);

const forbiddenLocalAuthority = [
  'crates/sdkwork-routes-membership-app-api/Cargo.toml',
  'crates/sdkwork-birdcoder-membership-service/Cargo.toml',
  'crates/sdkwork-birdcoder-membership-repository-sqlx/Cargo.toml',
];
for (const relativePath of forbiddenLocalAuthority) {
  assert.equal(
    fs.existsSync(path.join(rootDir, relativePath)),
    false,
    `${relativePath} must remain retired; sdkwork-membership owns this capability.`,
  );
}

const birdCoderOpenApi = JSON.parse(
  read('sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json'),
);
assert.equal(birdCoderOpenApi.paths?.['/app/v3/api/memberships/current'], undefined);
assert.equal(birdCoderOpenApi.paths?.['/app/v3/api/memberships/package_groups'], undefined);

const ordinaryPackageSources = [
  read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/package.json'),
  read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/package.json'),
  read('apps/sdkwork-birdcoder-h5/package.json'),
];
for (const source of ordinaryPackageSources) {
  assert.doesNotMatch(source, /@sdkwork\/membership-backend-sdk/u);
}

console.log('membership assembly integration contract passed.');
