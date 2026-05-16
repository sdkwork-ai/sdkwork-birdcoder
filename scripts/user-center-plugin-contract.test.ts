import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { BirdCoderApiTransportRequest } from '../packages/sdkwork-birdcoder-types/src/server-api.ts';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const appbaseRoot = path.resolve(workspaceRoot, '..', 'sdkwork-appbase');

function readWorkspaceText(relativePath: string): string {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.ok(existsSync(absolutePath), `Expected workspace file to exist: ${absolutePath}`);
  return readFileSync(absolutePath, 'utf8');
}

function readWorkspaceJson(relativePath: string): Record<string, any> {
  return JSON.parse(readWorkspaceText(relativePath));
}

function readAppbaseText(relativePath: string): string {
  const absolutePath = path.join(appbaseRoot, relativePath);
  assert.ok(existsSync(absolutePath), `Expected sdkwork-appbase file to exist: ${absolutePath}`);
  return readFileSync(absolutePath, 'utf8');
}

function assertRootImportOnly(source: string, specifier: string, label: string): void {
  const escapedSpecifier = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(
    source,
    new RegExp(`from ['"]${escapedSpecifier}['"]`, 'u'),
    `${label} must import ${specifier} through the package root entry.`,
  );
  assert.doesNotMatch(
    source,
    new RegExp(`${escapedSpecifier}/`, 'u'),
    `${label} must not use ${specifier} subpath imports.`,
  );
}

function assertNoDirectAppbaseSourceImport(source: string, label: string): void {
  assert.doesNotMatch(
    source,
    /sdkwork-appbase[\\/].*src[\\/]/u,
    `${label} must not import sdkwork-appbase source files through relative filesystem paths.`,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

const rootPackageJson = readWorkspaceJson('package.json');
const authPackageJson = readWorkspaceJson('packages/sdkwork-birdcoder-auth/package.json');
const userPackageJson = readWorkspaceJson('packages/sdkwork-birdcoder-user/package.json');
const infrastructurePackageJson = readWorkspaceJson(
  'packages/sdkwork-birdcoder-infrastructure/package.json',
);
const serverPackageJson = readWorkspaceJson('packages/sdkwork-birdcoder-server/package.json');
const shellPackageJson = readWorkspaceJson('packages/sdkwork-birdcoder-shell/package.json');
const shellRuntimePackageJson = readWorkspaceJson(
  'packages/sdkwork-birdcoder-shell-runtime/package.json',
);
const userIndexSource = readWorkspaceText('packages/sdkwork-birdcoder-user/src/index.ts');
const userCenterSource = readWorkspaceText('packages/sdkwork-birdcoder-user/src/user-center.ts');
const userCenterRuntimeSource = readWorkspaceText(
  'packages/sdkwork-birdcoder-user/src/user-center-runtime.ts',
);
const validationSource = readWorkspaceText('packages/sdkwork-birdcoder-user/src/validation.ts');
const storageSource = readWorkspaceText('packages/sdkwork-birdcoder-user/src/storage.ts');
const authSurfaceSource = readWorkspaceText('packages/sdkwork-birdcoder-auth/src/auth-surface.ts');
const userSurfaceSource = readWorkspaceText('packages/sdkwork-birdcoder-user/src/user-surface.ts');
const authPageSource = readWorkspaceText('packages/sdkwork-birdcoder-auth/src/pages/AuthPage.tsx');
const userPageSource = readWorkspaceText(
  'packages/sdkwork-birdcoder-user/src/pages/UserCenterPage.tsx',
);
const vipPageSource = readWorkspaceText(
  'packages/sdkwork-birdcoder-user/src/pages/VipPage.tsx',
);
const runtimeBridgeSource = readWorkspaceText(
  'packages/sdkwork-birdcoder-infrastructure/src/services/userCenterRuntimeBridge.ts',
);
const runtimeAuthServiceSource = readWorkspaceText(
  'packages/sdkwork-birdcoder-infrastructure/src/services/impl/RuntimeAuthService.ts',
);
const serverSource = readWorkspaceText('packages/sdkwork-birdcoder-server/src/index.ts');
const serverApiTypesSource = readWorkspaceText('packages/sdkwork-birdcoder-types/src/server-api.ts');
const appbaseValidationPackageJson = readWorkspaceJson(
  '../sdkwork-appbase/packages/pc-react/iam/sdkwork-user-center-validation-pc-react/package.json',
);
const appbaseAuthIndexSource = readAppbaseText(
  'packages/pc-react/iam/sdkwork-auth-pc-react/src/index.ts',
);
const appbaseAuthRuntimeIndexSource = readAppbaseText(
  'packages/pc-react/iam/sdkwork-auth-runtime-pc-react/src/index.ts',
);
const appbaseValidationSource = readAppbaseText(
  'packages/pc-react/iam/sdkwork-user-center-validation-pc-react/src/validation.ts',
);
const appbaseServerValidationSource = readAppbaseText(
  'packages/pc-react/iam/sdkwork-user-center-validation-pc-react/src/serverValidation.ts',
);

const iamStandardLane = rootPackageJson.scripts?.['check:iam-standard'];
assert.equal(typeof iamStandardLane, 'string');
for (const subcommand of [
  'node scripts/appbase-package-boundary-contract.test.mjs',
  'node scripts/birdcoder-iam-appbase-parity-contract.test.mjs',
  'node scripts/auth-ui-standard-contract.test.mjs',
  'node scripts/iam-command-matrix-contract.test.mjs',
  'node --experimental-strip-types scripts/user-center-plugin-contract.test.ts',
]) {
  assert.match(
    iamStandardLane,
    new RegExp(escapeRegExp(subcommand), 'u'),
    'BirdCoder root IAM standard lane must include the governed IAM contract commands.',
  );
}

assert.equal(
  authPackageJson.dependencies?.['@sdkwork/user-center-pc-react'],
  'workspace:*',
  'sdkwork-birdcoder-auth must consume the canonical user-center package directly.',
);
assert.equal(
  userPackageJson.dependencies?.['@sdkwork/user-center-pc-react'],
  'workspace:*',
  'sdkwork-birdcoder-user must consume the canonical user-center package directly.',
);
assert.equal(
  userPackageJson.dependencies?.['@sdkwork/user-center-validation-pc-react'],
  'workspace:*',
  'sdkwork-birdcoder-user must consume the canonical user-center validation package directly.',
);
assert.equal(
  userPackageJson.dependencies?.['@sdkwork/vip-pc-react'],
  'workspace:*',
  'sdkwork-birdcoder-user must consume the canonical VIP package directly.',
);
assert.equal(
  userPackageJson.dependencies?.['@sdkwork/birdcoder-infrastructure-runtime'],
  'workspace:*',
  'sdkwork-birdcoder-user must consume the runtime infrastructure facade instead of the full infrastructure package.',
);
assert.equal(
  userPackageJson.dependencies?.['@sdkwork/birdcoder-infrastructure'],
  undefined,
  'sdkwork-birdcoder-user must not depend on the full infrastructure package for runtime user-center adapters.',
);
assert.equal(
  infrastructurePackageJson.dependencies?.['@sdkwork/user-center-core-pc-react'],
  'workspace:*',
  'sdkwork-birdcoder-infrastructure must consume the canonical user-center core package directly.',
);
assert.equal(
  infrastructurePackageJson.dependencies?.['@sdkwork/user-center-validation-pc-react'],
  'workspace:*',
  'sdkwork-birdcoder-infrastructure must consume the canonical user-center validation package directly.',
);
assert.equal(
  infrastructurePackageJson.dependencies?.['@sdkwork/auth-runtime-pc-react'],
  'workspace:*',
  'sdkwork-birdcoder-infrastructure must consume the canonical appbase auth runtime package directly for runtime auth authority composition.',
);
assert.equal(
  infrastructurePackageJson.dependencies?.['@sdkwork/auth-pc-react'],
  undefined,
  'sdkwork-birdcoder-infrastructure must not depend on the UI auth package for runtime auth authority composition.',
);
assert.equal(
  serverPackageJson.dependencies?.['@sdkwork/user-center-core-pc-react'],
  'workspace:*',
  'sdkwork-birdcoder-server must consume the canonical user-center core package directly for app route projection.',
);

assert.equal(
  shellPackageJson.dependencies?.['@sdkwork/birdcoder-auth'],
  'workspace:*',
  'sdkwork-birdcoder-shell must consume the split auth package.',
);
assert.equal(
  shellPackageJson.dependencies?.['@sdkwork/birdcoder-user'],
  'workspace:*',
  'sdkwork-birdcoder-shell must consume the split user package.',
);
assert.equal(
  shellRuntimePackageJson.dependencies?.['@sdkwork/birdcoder-workbench-state'],
  'workspace:*',
  'sdkwork-birdcoder-shell-runtime must consume the split workbench-state package for local workbench bootstrap.',
);
assert.equal(
  shellRuntimePackageJson.dependencies?.['@sdkwork/birdcoder-user'],
  undefined,
  'sdkwork-birdcoder-shell-runtime must not depend on the UI-facing birdcoder-user package after the storage split.',
);
assert.equal(
  shellRuntimePackageJson.dependencies?.['@sdkwork/birdcoder-appbase-storage'],
  undefined,
  'sdkwork-birdcoder-shell-runtime must not retain the deleted appbase storage bridge.',
);

assert.match(
  userIndexSource,
  /export \* from '\.\/user-center(?:\.ts)?';/u,
  'sdkwork-birdcoder-user root entry must re-export user-center adapters.',
);
assert.match(
  userIndexSource,
  /export \* from '\.\/validation(?:\.ts)?';/u,
  'sdkwork-birdcoder-user root entry must re-export validation adapters.',
);
assert.match(
  userIndexSource,
  /export \* from '\.\/storage(?:\.ts)?';/u,
  'sdkwork-birdcoder-user root entry must re-export storage adapters.',
);
assert.doesNotMatch(
  userIndexSource,
  /profileStorage/u,
  'sdkwork-birdcoder-user must not export BirdCoder-local profile/VIP repositories after appbase IAM integration.',
);

assertRootImportOnly(
  userCenterSource,
  '@sdkwork/user-center-core-pc-react',
  'BirdCoder user-center adapter',
);
assertNoDirectAppbaseSourceImport(userCenterSource, 'BirdCoder user-center adapter');
assert.match(
  userCenterSource,
  /createBirdCoderUserCenterHandshakeSigningMessage/u,
  'BirdCoder user-center adapter must expose handshake signing helpers.',
);
assert.match(
  userCenterSource,
  /createBirdCoderUserCenterSignedHandshakeHeaders/u,
  'BirdCoder user-center adapter must expose signed handshake header helpers.',
);
assert.match(
  userCenterSource,
  /createBirdCoderUserCenterHandshakeVerificationContext/u,
  'BirdCoder user-center adapter must expose handshake verification helpers.',
);
assert.match(
  userCenterSource,
  /@sdkwork\/birdcoder-auth/u,
  'BirdCoder user-center plugin definition must point at the split auth package.',
);
assert.match(
  userCenterSource,
  /@sdkwork\/birdcoder-user/u,
  'BirdCoder user-center plugin definition must point at the split user package.',
);

assertRootImportOnly(
  userCenterRuntimeSource,
  '@sdkwork/birdcoder-infrastructure-runtime',
  'BirdCoder user-center runtime adapter',
);
assertRootImportOnly(
  userCenterRuntimeSource,
  '@sdkwork/user-center-core-pc-react',
  'BirdCoder user-center runtime adapter',
);

assertRootImportOnly(
  validationSource,
  '@sdkwork/user-center-validation-pc-react',
  'BirdCoder user-center validation adapter',
);
assertNoDirectAppbaseSourceImport(validationSource, 'BirdCoder user-center validation adapter');
assert.match(
  validationSource,
  /createBirdCoderUserCenterValidationPluginDefinition/u,
  'BirdCoder validation adapter must expose the independent validation plugin.',
);
assert.match(
  validationSource,
  /createBirdCoderUserCenterServerValidationPluginDefinition/u,
  'BirdCoder validation adapter must expose the independent server validation plugin.',
);
assert.match(
  validationSource,
  /createBirdCoderUserCenterValidationPreflightReport/u,
  'BirdCoder validation adapter must expose validation preflight reporting.',
);
assert.match(
  validationSource,
  /assertBirdCoderUserCenterValidationPreflight/u,
  'BirdCoder validation adapter must expose fail-closed validation preflight assertion.',
);
assert.match(
  validationSource,
  /BIRDCODER_USER_CENTER_VALIDATION_PLUGIN_PACKAGES/u,
  'BirdCoder validation adapter must define its own validation plugin package scope.',
);
assert.match(
  storageSource,
  /createBirdCoderRuntimeUserCenterClient/u,
  'BirdCoder user storage must consume the canonical runtime client factory instead of reassembling validation wiring locally.',
);
assert.doesNotMatch(
  storageSource,
  /getBirdCoderUserProfileRepository|getBirdCoderVipMembershipRepository|local-only/u,
  'BirdCoder user storage must not retain local profile/VIP repository fallback once appbase runtime client covers builtin-local.',
);
assert.doesNotMatch(
  userSurfaceSource,
  /readBirdCoderUserProfile|writeBirdCoderUserProfile|getBirdCoderUserProfileRepository/u,
  'BirdCoder user surface must not read or write duplicate local user profile storage.',
);
assert.doesNotMatch(
  vipPageSource + readWorkspaceText('packages/sdkwork-birdcoder-user/src/vip-surface.ts'),
  /readBirdCoderVipMembership|writeBirdCoderVipMembership|getBirdCoderVipMembershipRepository/u,
  'BirdCoder VIP surface must not read or write duplicate local VIP membership storage.',
);

assertRootImportOnly(
  runtimeBridgeSource,
  '@sdkwork/user-center-core-pc-react',
  'BirdCoder runtime bridge',
);
assertRootImportOnly(
  runtimeBridgeSource,
  '@sdkwork/user-center-validation-pc-react',
  'BirdCoder runtime bridge',
);
assertNoDirectAppbaseSourceImport(runtimeBridgeSource, 'BirdCoder runtime bridge');
assertRootImportOnly(
  runtimeAuthServiceSource,
  '@sdkwork/auth-runtime-pc-react',
  'BirdCoder runtime auth service',
);
assert.doesNotMatch(
  runtimeAuthServiceSource,
  /@sdkwork\/auth-pc-react/u,
  'BirdCoder runtime auth service must not import the UI auth package.',
);
assertNoDirectAppbaseSourceImport(runtimeAuthServiceSource, 'BirdCoder runtime auth service');
assertRootImportOnly(
  serverSource,
  '@sdkwork/user-center-core-pc-react',
  'BirdCoder coding server user-center route projection',
);
assertNoDirectAppbaseSourceImport(serverSource, 'BirdCoder coding server user-center route projection');
assert.doesNotMatch(
  serverApiTypesSource,
  /\/qr\/status\//u,
  'BirdCoder generated user-center client must not retain retired /auth/qr/status/{qrKey} path.',
);

const { createBirdCoderGeneratedUserCenterApiClient } = await import(
  '../packages/sdkwork-birdcoder-types/src/server-api.ts'
);
const observedUserCenterRequests: unknown[] = [];
const generatedUserCenterClient = createBirdCoderGeneratedUserCenterApiClient({
  transport: {
    async request<TResponse>(request: BirdCoderApiTransportRequest): Promise<TResponse> {
      observedUserCenterRequests.push(request);
      return {
        data: {
          expiresAt: '2026-05-16T00:00:00.000Z',
          qrKey: 'qr-standard-contract',
          status: 'pending',
        },
        meta: {
          version: 'v1',
        },
        requestId: 'request-standard-contract',
        timestamp: '2026-05-16T00:00:00.000Z',
      } as TResponse;
    },
  },
});
await generatedUserCenterClient.checkLoginQrCodeStatus('qr-standard-contract');
assert.deepEqual(
  observedUserCenterRequests,
  [
    {
      method: 'GET',
      path: '/app/v3/api/auth/qr_login_codes/qr-standard-contract',
    },
  ],
  'BirdCoder generated user-center client must call the canonical appbase QR status route through the generated client surface.',
);

assertRootImportOnly(
  authPageSource,
  '@sdkwork/user-center-pc-react',
  'BirdCoder auth page',
);
assertRootImportOnly(
  authPageSource,
  '@sdkwork/birdcoder-commons',
  'BirdCoder auth page auth context integration',
);
assert.match(
  authPageSource,
  /createSdkworkCanonicalAuthSurfacePage/u,
  'BirdCoder auth page must render the shared canonical auth surface page factory.',
);
assert.match(
  authPageSource,
  /\.\.\/auth-surface(?:\.ts)?/u,
  'BirdCoder auth page must delegate service assembly to the split auth surface adapter.',
);
assertRootImportOnly(
  authSurfaceSource,
  '@sdkwork/auth-pc-react',
  'BirdCoder auth surface adapter',
);
assert.match(
  authSurfaceSource,
  /createSdkworkCanonicalAuthController/u,
  'BirdCoder auth surface adapter must build on the shared canonical auth controller factory.',
);
assert.match(
  authSurfaceSource,
  /createSdkworkAuthUserFromCanonicalIdentity/u,
  'BirdCoder auth surface adapter must map BirdCoder identity into the canonical shared auth model.',
);
assertRootImportOnly(
  userPageSource,
  '@sdkwork/user-center-pc-react',
  'BirdCoder user page',
);
assertRootImportOnly(
  userPageSource,
  '@sdkwork/birdcoder-commons',
  'BirdCoder user page auth context integration',
);
assert.match(
  userPageSource,
  /createSdkworkCanonicalUserCenterSurfacePage/u,
  'BirdCoder user page must render the shared canonical user-center surface page factory.',
);
assertRootImportOnly(
  userSurfaceSource,
  '@sdkwork/user-pc-react',
  'BirdCoder user surface adapter',
);
assert.match(
  userSurfaceSource,
  /createSdkworkCanonicalUserService/u,
  'BirdCoder user surface adapter must build on the shared canonical user service factory.',
);
assert.match(
  userSurfaceSource,
  /createSdkworkCanonicalUserController/u,
  'BirdCoder user surface adapter must build on the shared canonical user controller factory.',
);
assert.match(
  userSurfaceSource,
  /createSdkworkCanonicalUserProfileAdapter/u,
  'BirdCoder user surface adapter must build on the shared canonical user profile adapter.',
);
assertRootImportOnly(vipPageSource, '@sdkwork/vip-pc-react', 'BirdCoder VIP page');
assert.match(
  vipPageSource,
  /SdkworkVipPage/u,
  'BirdCoder VIP page must render the shared appbase VIP page component.',
);

assert.equal(
  appbaseValidationPackageJson.dependencies?.['@sdkwork/user-center-core-pc-react'],
  'workspace:*',
  'sdkwork-user-center-validation-pc-react must depend on the canonical root user-center core package.',
);
assertRootImportOnly(
  appbaseValidationSource,
  '@sdkwork/user-center-core-pc-react',
  'sdkwork-appbase validation package',
);
assertRootImportOnly(
  appbaseServerValidationSource,
  '@sdkwork/user-center-core-pc-react',
  'sdkwork-appbase server validation package',
);
assert.doesNotMatch(
  appbaseValidationSource,
  /sdkwork-user-center-core-pc-react[\\/]src/u,
  'sdkwork-appbase validation package must not reach into sdkwork-user-center-core-pc-react source files directly.',
);
assert.doesNotMatch(
  appbaseServerValidationSource,
  /sdkwork-user-center-core-pc-react[\\/]src/u,
  'sdkwork-appbase server validation package must not reach into sdkwork-user-center-core-pc-react source files directly.',
);
assert.doesNotMatch(
  appbaseAuthIndexSource,
  /from ['"]\.\/(?:components|pages)\/[^'"]+(?<!\.(?:ts|tsx))['"]/u,
  'sdkwork-appbase auth package root must use extension-qualified exports so Node ESM contract tests can consume the canonical package root.',
);
assert.doesNotMatch(
  appbaseAuthRuntimeIndexSource,
  /export \* from ['"][^'"]*\/auth-(?:service|iam-runtime)\.ts['"]/u,
  'sdkwork-appbase auth runtime package root must not value-export core-backed UI auth service modules.',
);
assert.match(
  appbaseAuthRuntimeIndexSource,
  /createSdkworkCanonicalRuntimeAuthAuthorityService/u,
  'sdkwork-appbase auth runtime package root must expose the headless runtime auth authority service.',
);

assert.equal(
  existsSync(path.join(workspaceRoot, 'packages', 'sdkwork-birdcoder-appbase')),
  false,
  'sdkwork-birdcoder-appbase must remain fully removed.',
);
assert.equal(
  existsSync(path.join(workspaceRoot, 'packages', 'sdkwork-birdcoder-appbase-storage')),
  false,
  'sdkwork-birdcoder-appbase-storage must remain fully removed.',
);

console.log('birdcoder user-center plugin contract passed.');
