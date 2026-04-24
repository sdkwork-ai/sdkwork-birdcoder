import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = path.resolve(import.meta.dirname, '..');
const appbaseRootDir = process.env.SDKWORK_APPBASE_ROOT
  ? path.resolve(rootDir, process.env.SDKWORK_APPBASE_ROOT)
  : path.resolve(rootDir, '..', 'sdkwork-appbase');

function readText(baseDir, relativePath) {
  const absolutePath = path.join(baseDir, relativePath);
  assert.ok(fs.existsSync(absolutePath), `Expected path to exist: ${absolutePath}`);
  return fs.readFileSync(absolutePath, 'utf8');
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

assert.ok(
  fs.existsSync(appbaseRootDir),
  `Expected sdkwork-appbase reference repo to exist at ${appbaseRootDir}.`,
);

const authUpstreamSource = readText(
  appbaseRootDir,
  'packages/pc-react/identity/sdkwork-auth-pc-react/src/auth.ts',
);
const userUpstreamSource = readText(
  appbaseRootDir,
  'packages/pc-react/identity/sdkwork-user-pc-react/src/user.ts',
);
const vipUpstreamSource = readText(
  appbaseRootDir,
  'packages/pc-react/commerce/sdkwork-vip-pc-react/src/vip.ts',
);
const userCenterCanonicalDefinitionSource = readText(
  appbaseRootDir,
  'packages/pc-react/identity/sdkwork-user-center-core-pc-react/src/domain/userCenterCanonicalDefinition.ts',
);

const rootPackageJson = JSON.parse(readText(rootDir, 'package.json'));
const authPackageJson = JSON.parse(readText(rootDir, 'packages/sdkwork-birdcoder-auth/package.json'));
const userPackageJson = JSON.parse(readText(rootDir, 'packages/sdkwork-birdcoder-user/package.json'));
const shellPackageJson = JSON.parse(readText(rootDir, 'packages/sdkwork-birdcoder-shell/package.json'));

const authLocalSource = readText(rootDir, 'packages/sdkwork-birdcoder-auth/src/auth.ts');
const userLocalSource = readText(rootDir, 'packages/sdkwork-birdcoder-user/src/user.ts');
const vipLocalSource = readText(rootDir, 'packages/sdkwork-birdcoder-user/src/vip.ts');
const userCenterLocalSource = readText(rootDir, 'packages/sdkwork-birdcoder-user/src/user-center.ts');
const userCenterRuntimeLocalSource = readText(
  rootDir,
  'packages/sdkwork-birdcoder-user/src/user-center-runtime.ts',
);
const validationLocalSource = readText(rootDir, 'packages/sdkwork-birdcoder-user/src/validation.ts');
const storageLocalSource = readText(rootDir, 'packages/sdkwork-birdcoder-user/src/storage.ts');

const identityStandardLane = rootPackageJson.scripts?.['check:identity-standard'];
assert.equal(typeof identityStandardLane, 'string');
for (const subcommand of [
  'node scripts/birdcoder-identity-standard-contract.test.mjs',
  'node scripts/auth-ui-standard-contract.test.mjs',
  'node scripts/identity-command-matrix-contract.test.mjs',
  'node --experimental-strip-types scripts/user-center-plugin-contract.test.ts',
]) {
  assert.match(
    identityStandardLane,
    new RegExp(escapeRegExp(subcommand), 'u'),
    'BirdCoder must expose the canonical identity standard lane from the workspace root.',
  );
}

assert.equal(authPackageJson.name, '@sdkwork/birdcoder-auth');
assert.equal(userPackageJson.name, '@sdkwork/birdcoder-user');
assert.equal(shellPackageJson.dependencies?.['@sdkwork/birdcoder-auth'], 'workspace:*');
assert.equal(shellPackageJson.dependencies?.['@sdkwork/birdcoder-user'], 'workspace:*');
assert.equal(shellPackageJson.dependencies?.['@sdkwork/birdcoder-appbase'], undefined);

assertExports(
  authUpstreamSource,
  [
    'SdkworkAuthWorkspaceManifest',
    'createAuthWorkspaceManifest',
    'createAuthRouteIntent',
    'authPackageMeta',
  ],
  'sdkwork-appbase auth reference',
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
assert.match(authLocalSource, /bridgePackageName:\s*'@sdkwork\/birdcoder-auth'/u);

assertExports(
  userUpstreamSource,
  [
    'SdkworkUserWorkspaceManifest',
    'createUserWorkspaceManifest',
    'createUserRouteIntent',
    'createUserSectionRouteIntent',
    'userPackageMeta',
  ],
  'sdkwork-appbase user reference',
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
assert.match(userLocalSource, /bridgePackageName:\s*'@sdkwork\/birdcoder-user'/u);

assertExports(
  vipUpstreamSource,
  [
    'SdkworkVipWorkspaceManifest',
    'createVipWorkspaceManifest',
    'createVipRouteIntent',
    'vipPackageMeta',
  ],
  'sdkwork-appbase vip reference',
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
assert.match(vipLocalSource, /bridgePackageName:\s*'@sdkwork\/birdcoder-user'/u);

assert.match(userCenterCanonicalDefinitionSource, /createSdkworkCanonicalUserCenterDefinition/u);
assert.match(userCenterCanonicalDefinitionSource, /USER_CENTER_SOURCE_PACKAGE_NAME/u);
assert.match(userCenterLocalSource, /@sdkwork\/user-center-core-pc-react/u);
assert.match(userCenterLocalSource, /@sdkwork\/birdcoder-auth/u);
assert.match(userCenterLocalSource, /@sdkwork\/birdcoder-user/u);
assert.match(userCenterRuntimeLocalSource, /@sdkwork\/user-center-core-pc-react/u);
assert.match(userCenterRuntimeLocalSource, /@sdkwork\/birdcoder-infrastructure/u);
assert.match(validationLocalSource, /@sdkwork\/user-center-validation-pc-react/u);
assert.match(storageLocalSource, /createBirdCoderRuntimeUserCenterClient/u);

console.log('birdcoder identity standard contract passed.');
