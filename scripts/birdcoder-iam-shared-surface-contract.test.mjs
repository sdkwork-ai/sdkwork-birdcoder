import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { SDKWORK_IAM_WORKSPACE_REL } from './birdcoder-iam-workspace-paths.mjs';

const rootDir = path.resolve(import.meta.dirname, '..');
const iamRootDir = process.env.SDKWORK_IAM_ROOT
  ? path.resolve(rootDir, process.env.SDKWORK_IAM_ROOT)
  : path.resolve(rootDir, SDKWORK_IAM_WORKSPACE_REL);

function readText(baseDir, relativePath) {
  const absolutePath = path.join(baseDir, relativePath);
  assert.ok(fs.existsSync(absolutePath), `Expected path to exist: ${absolutePath}`);
  return fs.readFileSync(absolutePath, 'utf8');
}

function readJson(baseDir, relativePath) {
  return JSON.parse(readText(baseDir, relativePath));
}

function collectExportNames(source) {
  return Array.from(
    source.matchAll(/^export\s+(?:type|interface|function|const)\s+([A-Za-z0-9_]+)/gm),
    (match) => match[1],
  );
}

function assertExports(source, names, label) {
  const exportNames = new Set(collectExportNames(source));
  for (const name of names) {
    assert.ok(exportNames.has(name), `${label} must export ${name}.`);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function assertNoUserCenterDependency(packageJson, label) {
  const dependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
    ...(packageJson.peerDependencies ?? {}),
  };

  for (const dependencyName of Object.keys(dependencies)) {
    assert.equal(
      dependencyName.startsWith('@sdkwork/user-center-'),
      false,
      `${label} must not depend on ${dependencyName}; BirdCoder must use standard IAM and split auth/user/vip surfaces directly.`,
    );
  }
}

assert.ok(
  fs.existsSync(iamRootDir),
  `Expected sdkwork-iam reference repo to exist at ${iamRootDir}.`,
);

const authUpstreamSource = readText(
  iamRootDir,
  'apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth.ts',
);
const authIamRuntimeUpstreamSource = readText(
  iamRootDir,
  'apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-iam-runtime.ts',
);
const authRoutesUpstreamSource = readText(
  iamRootDir,
  'apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/pages/IamAuthRoutes.tsx',
);
const userUpstreamSource = readText(
  iamRootDir,
  'apps/sdkwork-iam-pc/packages/sdkwork-user-pc-react/src/user.ts',
);
const rootPackageJson = readJson(rootDir, 'package.json');
const authPackageJson = readJson(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/package.json');
const userPackageJson = readJson(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/package.json');
const iamPackageJson = readJson(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-iam/package.json');
const shellPackageJson = readJson(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/package.json');
const infrastructurePackageJson = readJson(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/package.json');

const authLocalSource = readText(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/src/auth.ts');
const authSurfaceLocalSource = readText(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/src/auth-surface.ts');
const authPageLocalSource = readText(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/src/pages/AuthPage.tsx');
const userLocalSource = readText(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/user.ts');
const userSurfaceLocalSource = readText(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/user-surface.ts');
const vipLocalSource = readText(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/vip.ts');
const vipSurfaceLocalSource = readText(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/vip-surface.ts');
const vipMembershipServiceSource = readText(
  rootDir,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedVipMembershipService.ts',
);
const iamIntegrationLocalSource = readText(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-iam/src/iamIntegration.ts');
const infrastructureIamRuntimeSource = readText(
  rootDir,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/iamRuntime.ts',
);
const infrastructureSessionServiceSource = readText(
  rootDir,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sessionService.ts',
);

const iamStandardLane = rootPackageJson.scripts?.['check:iam-standard'];
assert.equal(typeof iamStandardLane, 'string');
for (const subcommand of [
  'node scripts/birdcoder-iam-runtime-standard-contract.test.mjs',
  'node scripts/birdcoder-iam-shared-surface-contract.test.mjs',
  'node scripts/auth-ui-standard-contract.test.mjs',
  'node scripts/iam-command-matrix-contract.test.mjs',
]) {
  assert.match(
    iamStandardLane,
    new RegExp(escapeRegExp(subcommand), 'u'),
    'BirdCoder must expose the canonical IAM standard lane from the workspace root.',
  );
}
assert.doesNotMatch(
  iamStandardLane,
  /user-center/u,
  'BirdCoder IAM standard lane must not run retired user-center contracts.',
);

assert.equal(authPackageJson.name, '@sdkwork/birdcoder-pc-auth');
assert.equal(userPackageJson.name, '@sdkwork/birdcoder-pc-user');
assert.equal(iamPackageJson.name, '@sdkwork/birdcoder-pc-iam');
assert.equal(shellPackageJson.dependencies?.['@sdkwork/birdcoder-pc-auth'], undefined);
assert.equal(shellPackageJson.dependencies?.['@sdkwork/birdcoder-pc-iam'], 'workspace:*');
assert.equal(shellPackageJson.dependencies?.['@sdkwork/birdcoder-pc-user'], 'workspace:*');
assert.equal(shellPackageJson.dependencies?.['@sdkwork/birdcoder-pc-appbase'], undefined);
assert.equal(
  authPackageJson.dependencies?.['@sdkwork/birdcoder-pc-infrastructure-runtime'],
  undefined,
  'BirdCoder auth package must stay UI-only; IAM runtime binding belongs to @sdkwork/birdcoder-pc-iam.',
);
assert.equal(
  authPackageJson.dependencies?.['@sdkwork/birdcoder-pc-core'],
  undefined,
  'BirdCoder auth package must not depend on pc-core; session ownership belongs to shell-runtime/bootstrap, not auth UI.',
);

const serviceContextSource = readText(
  rootDir,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/context/ServiceContext.tsx',
);
assert.match(
  serviceContextSource,
  /IVipMembershipService/u,
  'ServiceContext must expose vipMembershipService on the canonical IDE service boundary.',
);
assert.match(
  serviceContextSource,
  /AppIdeServices/u,
  'ServiceContext must compose lazy app IDE services including VIP membership.',
);

for (const [label, packageJson] of [
  ['workspace root', rootPackageJson],
  ['BirdCoder auth package', authPackageJson],
  ['BirdCoder user package', userPackageJson],
  ['BirdCoder IAM package', iamPackageJson],
  ['BirdCoder infrastructure package', infrastructurePackageJson],
]) {
  assertNoUserCenterDependency(packageJson, label);
}

assertExports(
  authUpstreamSource,
  [
    'SdkworkAuthWorkspaceManifest',
    'createAuthWorkspaceManifest',
    'createAuthRouteIntent',
    'authPackageMeta',
  ],
  'shared SDKWork auth reference',
);
assertExports(
  authLocalSource,
  [
    'BirdCoderAuthWorkspaceManifest',
    'createBirdCoderAuthWorkspaceManifest',
    'createBirdCoderAuthRouteIntent',
    'authPackageMeta',
  ],
  'birdcoder auth adapter',
);
assert.match(authLocalSource, /@sdkwork\/auth-pc-react/u);
assert.match(authLocalSource, /bridgePackageName:\s*'@sdkwork\/birdcoder-pc-auth'/u);
assert.match(authLocalSource, /domain:\s*'iam'/u);

assert.match(
  authIamRuntimeUpstreamSource,
  /createSdkworkIamRuntimeAuthController/u,
  'shared SDKWork auth reference must provide IAM runtime controller support.',
);
assert.match(
  authRoutesUpstreamSource,
  /SdkworkIamAuthRoutes/u,
  'shared SDKWork auth reference must provide the IAM auth routes component.',
);
assert.match(
  authSurfaceLocalSource,
  /createSdkworkIamRuntimeAuthController/u,
  'birdcoder auth surface must bind the shared IAM runtime controller.',
);
assert.match(
  authPageLocalSource,
  /SdkworkIamAuthRoutes/u,
  'birdcoder auth page must render the shared IAM auth routes.',
);

assertExports(
  userUpstreamSource,
  [
    'SdkworkUserWorkspaceManifest',
    'createUserWorkspaceManifest',
    'createUserRouteIntent',
    'createUserSectionRouteIntent',
    'userPackageMeta',
  ],
  'shared SDKWork user reference',
);
assertExports(
  userLocalSource,
  [
    'BirdCoderUserWorkspaceManifest',
    'createBirdCoderUserWorkspaceManifest',
    'createBirdCoderUserRouteIntent',
    'createBirdCoderUserSectionRouteIntent',
    'userPackageMeta',
  ],
  'birdcoder user adapter',
);
assert.match(userLocalSource, /@sdkwork\/user-pc-react/u);
assert.match(userLocalSource, /bridgePackageName:\s*'@sdkwork\/birdcoder-pc-user'/u);
assert.match(userLocalSource, /domain:\s*'iam'/u);
assert.match(
  userSurfaceLocalSource,
  /createSdkworkCanonicalUserController/u,
  'birdcoder user surface must bind the shared user controller, not a user-center facade.',
);

assertExports(
  vipLocalSource,
  [
    'BirdCoderVipWorkspaceManifest',
    'createBirdCoderVipWorkspaceManifest',
    'createBirdCoderVipRouteIntent',
    'vipPackageMeta',
  ],
  'birdcoder vip adapter',
);
assert.match(vipLocalSource, /BIRDCODER_VIP_PACKAGE_NAME\s*=\s*'@sdkwork\/birdcoder-pc-user'/u);
assert.match(vipLocalSource, /bridgePackage:\s*BIRDCODER_VIP_PACKAGE_NAME/u);
assert.match(vipLocalSource, /bridgePackageName:\s*BIRDCODER_VIP_PACKAGE_NAME/u);
assert.match(vipLocalSource, /domain:\s*'commerce'/u);
assert.doesNotMatch(
  vipLocalSource,
  /@sdkwork\/vip-pc-react|BRIDGE_PACKAGE_NAME/u,
  'birdcoder vip adapter must be a BirdCoder commerce manifest, not a local patch over the retired shared VIP UI package.',
);
assert.match(
  vipSurfaceLocalSource,
  /vipMembershipService\.loadMembershipState\(\)/u,
  'birdcoder vip surface must load membership state through the IDE VIP membership service boundary.',
);
assert.doesNotMatch(
  vipSurfaceLocalSource,
  /getBirdCoderGeneratedAppSdkClient\(\)\.commerce\.memberships/u,
  'birdcoder vip surface must not call the generated commerce SDK directly.',
);
assert.match(
  vipMembershipServiceSource,
  /appClient\.commerce\.memberships\.current\.retrieve\(\)/u,
  'birdcoder vip membership service must read current membership through the generated commerce.memberships.current SDK surface.',
);
assert.match(
  vipMembershipServiceSource,
  /appClient\.commerce\.memberships\.packageGroups\.list\(\)/u,
  'birdcoder vip membership service must read membership package groups through the generated commerce.memberships.packageGroups SDK surface.',
);
assert.doesNotMatch(
  vipSurfaceLocalSource,
  /@sdkwork\/vip-pc-react|createSdkworkVipController|createSdkworkVipService|\/billing\/vip/u,
  'birdcoder vip surface must not keep the retired shared VIP UI, local VIP service, or billing/vip alias.',
);

assert.match(
  iamIntegrationLocalSource,
  /getBirdCoderIamRuntime/u,
  'birdcoder IAM facade must expose the generated-SDK backed IAM runtime.',
);
assert.match(
  infrastructureIamRuntimeSource,
  /createSdkworkAppbasePcAuthRuntime/u,
  'birdcoder infrastructure must use the high-level appbase PC auth runtime factory.',
);
assert.doesNotMatch(
  infrastructureIamRuntimeSource,
  /@sdkwork\/iam-sdk-adapter|createIamSdkAdapters|createIamRuntime\(/u,
  'birdcoder infrastructure must not wire low-level IAM SDK adapters directly in product code.',
);
assert.match(
  infrastructureSessionServiceSource,
  /getBirdCoderIamRuntime/u,
  'birdcoder infrastructure session service must use the standard appbase IAM runtime boundary.',
);
assert.doesNotMatch(
  infrastructureSessionServiceSource,
  /runtime\.service\.auth\.sessions\.create/u,
  'birdcoder infrastructure must not create session_bridge sessions in product code; appbase owns login/session creation.',
);
assert.match(
  infrastructureSessionServiceSource,
  /runtime\.service\.auth\.sessions\.current\.retrieve/u,
  'birdcoder infrastructure must restore app sessions through the appbase current-session resource.',
);
assert.match(
  infrastructureSessionServiceSource,
  /runtime\.service\.auth\.sessions\.current\.delete/u,
  'birdcoder infrastructure must revoke app sessions through the appbase IAM runtime service.',
);
assert.doesNotMatch(
  infrastructureSessionServiceSource,
  /getBirdCoderGeneratedAppSdkClient\([^)]*\)\.auth\.sessions/u,
  'birdcoder infrastructure must not use the BirdCoder product app SDK as the IAM session authority.',
);

for (const retiredPath of [
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/user-center.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/user-center-runtime.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/storage.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/validation.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/userCenterRuntimeBridge.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-core/src/userCenterSession.ts',
]) {
  assert.equal(
    fs.existsSync(path.join(rootDir, retiredPath)),
    false,
    `${retiredPath} must stay deleted; BirdCoder must not reintroduce local user-center compatibility adapters.`,
  );
}

for (const [source, label] of [
  [authSurfaceLocalSource, 'birdcoder auth surface'],
  [authPageLocalSource, 'birdcoder auth page'],
  [userSurfaceLocalSource, 'birdcoder user surface'],
  [vipSurfaceLocalSource, 'birdcoder vip surface'],
  [iamIntegrationLocalSource, 'birdcoder IAM facade'],
  [infrastructureIamRuntimeSource, 'birdcoder IAM runtime'],
  [infrastructureSessionServiceSource, 'birdcoder IAM session service'],
]) {
  assert.doesNotMatch(
    source,
    /@sdkwork\/user-center-|createSdkworkCanonicalUserCenter|createBirdCoderRuntimeUserCenterClient|userCenterRuntimeBridge|UserCenterRuntime/u,
    `${label} must not use the retired user-center adapter surface.`,
  );
}

console.log('birdcoder IAM standard contract passed.');
