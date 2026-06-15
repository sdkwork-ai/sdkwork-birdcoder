import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const appbaseWorkspaceRoot = path.resolve(workspaceRoot, '..', 'sdkwork-appbase');

function readText(relativePath) {
  return fs.readFileSync(path.resolve(workspaceRoot, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function readAppbaseText(relativePath) {
  return fs.readFileSync(path.resolve(appbaseWorkspaceRoot, relativePath), 'utf8');
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
      `${label} must not depend on ${dependencyName}; BirdCoder uses the standard IAM runtime and the split auth/user/vip packages directly.`,
    );
  }
}

function assertNoUserCenterSource(source, label) {
  assert.doesNotMatch(
    source,
    /@sdkwork\/user-center-|createSdkworkCanonicalAuthSurfacePage|createSdkworkCanonicalUserCenterSurfacePage|userCenterRuntimeBridge|UserCenterRuntime|user-center-runtime/u,
    `${label} must not keep the retired application-level user-center surface.`,
  );
}

const authPackageJson = readJson('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/package.json');
const iamPackageJson = readJson('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-iam/package.json');
const userPackageJson = readJson('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/package.json');
const workspacePackageJson = readJson('package.json');
const authTsconfig = readJson('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/tsconfig.json');
const userTsconfig = readJson('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/tsconfig.json');
const authPageSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/src/pages/AuthPage.tsx');
const authSurfaceSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/src/auth-surface.ts');
const iamIntegrationSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-iam/src/iamIntegration.ts');
const userPageSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/pages/UserPage.tsx');
const vipPageSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/pages/VipPage.tsx');
const userSurfaceSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/user-surface.ts');
const vipSurfaceSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/vip-surface.ts');
const vitePluginSource = readText('scripts/create-birdcoder-vite-plugins.mjs');
const shellStylesheetSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/styles/index.css');
const sharedAuthRoutesSource = readAppbaseText('packages/pc-react/iam/sdkwork-auth-pc-react/src/pages/IamAuthRoutes.tsx');
const sharedAuthRuntimeSource = readAppbaseText('packages/pc-react/iam/sdkwork-auth-pc-react/src/auth-iam-runtime.ts');
const sharedUserPackageJson = JSON.parse(
  readAppbaseText('packages/pc-react/iam/sdkwork-user-pc-react/package.json'),
);
assert.equal(
  authPackageJson.dependencies?.['@sdkwork/auth-pc-react'],
  'workspace:*',
  'sdkwork-birdcoder-auth must consume the canonical @sdkwork/auth-pc-react package directly.',
);
assert.equal(
  authPackageJson.dependencies?.['@sdkwork/birdcoder-pc-infrastructure-runtime'],
  undefined,
  'sdkwork-birdcoder-auth must stay UI-only; runtime binding is owned by sdkwork-birdcoder-iam.',
);
assert.equal(
  iamPackageJson.dependencies?.['@sdkwork/birdcoder-pc-auth'],
  'workspace:*',
  'sdkwork-birdcoder-iam must compose the BirdCoder auth UI package.',
);
assert.equal(
  iamPackageJson.dependencies?.['@sdkwork/birdcoder-pc-infrastructure'],
  'workspace:*',
  'sdkwork-birdcoder-iam must bind auth UI to the infrastructure IAM runtime through the public package entry.',
);
assert.equal(
  userPackageJson.dependencies?.['@sdkwork/user-pc-react'],
  'workspace:*',
  'sdkwork-birdcoder-user must consume the canonical @sdkwork/user-pc-react package directly.',
);
assert.equal(
  userPackageJson.dependencies?.['@sdkwork/vip-pc-react'],
  undefined,
  'sdkwork-birdcoder-user must not depend on the retired shared VIP UI package; commerce membership uses the generated BirdCoder app SDK.',
);

assertNoUserCenterDependency(authPackageJson, 'sdkwork-birdcoder-auth');
assertNoUserCenterDependency(iamPackageJson, 'sdkwork-birdcoder-iam');
assertNoUserCenterDependency(userPackageJson, 'sdkwork-birdcoder-user');
assertNoUserCenterDependency(workspacePackageJson, 'workspace root');

assert.equal(
  authTsconfig.compilerOptions?.paths?.['@sdkwork/auth-pc-react'],
  undefined,
  'sdkwork-birdcoder-auth tsconfig must not override @sdkwork/auth-pc-react; shared package resolution must come from the workspace package root.',
);
assert.equal(
  userTsconfig.compilerOptions?.paths?.['@sdkwork/user-pc-react'],
  undefined,
  'sdkwork-birdcoder-user tsconfig must not override @sdkwork/user-pc-react; shared package resolution must come from the workspace package root.',
);

assert.match(
  sharedAuthRoutesSource,
  /export function SdkworkIamAuthRoutes/u,
  'sdkwork-auth-pc-react must expose the standard IAM auth route renderer.',
);
assert.match(
  sharedAuthRuntimeSource,
  /createSdkworkIamRuntimeAuthController/u,
  'sdkwork-auth-pc-react must expose the standard IAM runtime auth controller.',
);
assert.deepEqual(
  sharedUserPackageJson.exports?.['.'],
  {
    types: './src/index.ts',
    import: './src/index.ts',
    default: './src/index.ts',
  },
  'sdkwork-user-pc-react must publish the canonical root entry for embedded host applications.',
);
assert.match(
  authPageSource,
  /SdkworkIamAuthRoutes/u,
  'BirdCoder AuthPage must render SdkworkIamAuthRoutes.',
);
assert.match(
  authPageSource,
  /getRuntime=\{getRuntime\}/u,
  'BirdCoder AuthPage must receive the IAM runtime from the IAM integration boundary.',
);
assert.match(
  iamIntegrationSource,
  /loadAuthPage\(\{ getRuntime: getBirdCoderIamRuntime \}\)/u,
  'BirdCoder IAM integration must inject the generated-SDK backed IAM runtime into the auth page loader.',
);
assert.match(
  authSurfaceSource,
  /createSdkworkIamRuntimeAuthController/u,
  'BirdCoder auth surface must use the standard IAM runtime auth controller.',
);

for (const [source, label] of [
  [authPageSource, 'BirdCoder AuthPage'],
  [authSurfaceSource, 'BirdCoder auth surface'],
  [userPageSource, 'BirdCoder user page'],
  [vipPageSource, 'BirdCoder VIP page'],
  [userSurfaceSource, 'BirdCoder user surface'],
  [vipSurfaceSource, 'BirdCoder VIP surface'],
]) {
  assertNoUserCenterSource(source, label);
}

assert.match(
  userSurfaceSource,
  /createSdkworkCanonicalUserController/u,
  'BirdCoder user surface must use the canonical sdkwork user controller.',
);
assert.match(
  vipSurfaceSource,
  /getBirdCoderGeneratedAppSdkClient\(\)\.commerce\.memberships\.current\.retrieve\(\)/u,
  'BirdCoder VIP surface must read current membership through the generated commerce.memberships.current SDK surface.',
);
assert.match(
  vipSurfaceSource,
  /getBirdCoderGeneratedAppSdkClient\(\)\.commerce\.memberships\.packageGroups\.list\(\)/u,
  'BirdCoder VIP surface must read membership package groups through the generated commerce.memberships.packageGroups SDK surface.',
);
assert.doesNotMatch(
  vipSurfaceSource,
  /@sdkwork\/vip-pc-react|createSdkworkVipController|createSdkworkVipService|\/billing\/vip/u,
  'BirdCoder VIP surface must not keep the retired shared VIP UI, local VIP service, or billing/vip alias.',
);

assert.match(
  vitePluginSource,
  /find: ['"]@sdkwork\/auth-pc-react['"]/u,
  'BirdCoder Vite aliases must resolve @sdkwork/auth-pc-react from sdkwork-appbase.',
);
assert.match(
  vitePluginSource,
  /find: ['"]@sdkwork\/user-pc-react['"]/u,
  'BirdCoder Vite aliases must resolve @sdkwork/user-pc-react from sdkwork-appbase.',
);
assert.doesNotMatch(
  vitePluginSource,
  /find:\s*(?:['"]@sdkwork\/vip-pc-react['"]|\/\^@sdkwork\\\/vip-pc-react\\\/)/u,
  'BirdCoder Vite aliases must not keep the retired shared VIP UI package entrypoints.',
);
assert.doesNotMatch(
  vitePluginSource,
  /find: ['"]@sdkwork\/user-center-pc-react['"]/u,
  'BirdCoder Vite aliases must not keep retired user-center appbase entrypoints.',
);
assert.match(
  vitePluginSource,
  /find: ['"]@sdkwork\/auth-runtime-pc-react['"]/u,
  'BirdCoder Vite aliases must resolve the high-level appbase auth runtime package.',
);

assert.match(
  shellStylesheetSource,
  /sdkwork-appbase\/packages\/pc-react\/iam\/sdkwork-auth-pc-react\/src/u,
  'BirdCoder shell stylesheet must scan the shared auth source tree for Tailwind classes.',
);
assert.match(
  shellStylesheetSource,
  /sdkwork-appbase\/packages\/pc-react\/iam\/sdkwork-user-pc-react\/src/u,
  'BirdCoder shell stylesheet must scan the shared user source tree for Tailwind classes.',
);
assert.match(
  shellStylesheetSource,
  /sdkwork-ui\/sdkwork-ui-pc-react\/src/u,
  'BirdCoder shell stylesheet must scan the shared UI source tree required by shared auth/user components.',
);

assert.match(
  workspacePackageJson.scripts?.['check:iam-standard'] ?? '',
  /auth-ui-standard-contract\.test\.mjs/u,
  'BirdCoder IAM standard checks must include the auth UI standard contract.',
);

console.log('birdcoder auth ui standard contract passed.');
