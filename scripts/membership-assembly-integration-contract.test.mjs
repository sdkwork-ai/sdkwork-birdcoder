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
const stackRunner = read('scripts/run-birdcoder-dev-stack.mjs');
assert.match(assemblyCargo, /sdkwork-api-membership-assembly\.workspace = true/u);
assert.match(
  assemblyBootstrap,
  /sdkwork_api_membership_assembly::assemble_api_router_from_env\(\)/u,
);
assert.match(assemblyBootstrap, /\.merge\(membership\.router\)/u);
assert.match(stackRunner, /SDKWORK_MEMBERSHIP_DATABASE_URL/u);
assert.match(stackRunner, /SDKWORK_MEMBERSHIP_APP_ROOT/u);
assert.doesNotMatch(stackRunner, /platformGateway|cloud-gateway/u);

const membershipBootstrap = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/membershipSdkBootstrap.ts',
);
assert.match(membershipBootstrap, /VITE_SDKWORK_MEMBERSHIP_APP_API_BASE_URL/u);
assert.match(membershipBootstrap, /VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL/u);
assert.match(membershipBootstrap, /bootstrapSdkworkMembershipAppService/u);
assert.match(membershipBootstrap, /getBirdCoderGlobalTokenManager/u);
assert.match(membershipBootstrap, /getDefaultBirdCoderIdeServicesRuntimeConfig\(\)\.apiBaseUrl/u);

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

const birdCoderOpenApi = JSON.parse(read('artifacts/openapi/coding-server-v1.json'));
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
