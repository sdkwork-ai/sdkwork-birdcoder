import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const appbaseRootDir = process.env.SDKWORK_APPBASE_ROOT
  ? path.resolve(rootDir, process.env.SDKWORK_APPBASE_ROOT)
  : path.resolve(rootDir, '..', 'sdkwork-appbase');

function readText(baseDir, relativePath) {
  const absolutePath = path.join(baseDir, relativePath);
  assert.ok(fs.existsSync(absolutePath), `Expected path to exist: ${absolutePath}`);
  return fs.readFileSync(absolutePath, 'utf8');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

const authLocalSource = readText(rootDir, 'packages/sdkwork-birdcoder-appbase/src/auth.ts');
const userLocalSource = readText(rootDir, 'packages/sdkwork-birdcoder-appbase/src/user.ts');
const vipLocalSource = readText(rootDir, 'packages/sdkwork-birdcoder-appbase/src/vip.ts');

assertExports(
  authUpstreamSource,
  [
    'SdkworkAuthRouteId',
    'SdkworkAuthRouteDefinition',
    'SdkworkAuthWorkspaceManifest',
    'CreateAuthWorkspaceManifestOptions',
    'SdkworkAuthRouteIntent',
    'CreateAuthRouteIntentOptions',
    'createAuthRouteCatalog',
    'createAuthWorkspaceManifest',
    'createAuthRouteIntent',
    'authPackageMeta',
    'AuthPackageMeta',
  ],
  'sdkwork-appbase auth reference',
);

assertExports(
  authLocalSource,
  [
    'BirdCoderAuthRouteId',
    'BirdCoderAuthRouteDefinition',
    'BirdCoderAuthWorkspaceManifest',
    'CreateBirdCoderAuthWorkspaceManifestOptions',
    'BirdCoderAuthRouteIntent',
    'CreateBirdCoderAuthRouteIntentOptions',
    'createBirdCoderAuthRouteCatalog',
    'createBirdCoderAuthWorkspaceManifest',
    'createAuthRouteCatalog',
    'createAuthWorkspaceManifest',
    'createBirdCoderAuthRouteIntent',
    'createAuthRouteIntent',
    'authPackageMeta',
    'AuthPackageMeta',
  ],
  'sdkwork-birdcoder appbase auth bridge',
);

assertExports(
  userUpstreamSource,
  [
    'SdkworkUserWorkspaceManifest',
    'CreateUserWorkspaceManifestOptions',
    'SdkworkUserRouteIntent',
    'CreateUserRouteIntentOptions',
    'SdkworkUserSectionRouteIntent',
    'CreateUserSectionRouteIntentOptions',
    'createUserWorkspaceManifest',
    'createUserRouteIntent',
    'createUserSectionRouteIntent',
    'userPackageMeta',
    'UserPackageMeta',
  ],
  'sdkwork-appbase user reference',
);

assertExports(
  userLocalSource,
  [
    'BirdCoderUserWorkspaceManifest',
    'CreateBirdCoderUserWorkspaceManifestOptions',
    'BirdCoderUserRouteIntent',
    'CreateBirdCoderUserRouteIntentOptions',
    'BirdCoderUserSectionRouteIntent',
    'CreateBirdCoderUserSectionRouteIntentOptions',
    'createBirdCoderUserWorkspaceManifest',
    'createUserWorkspaceManifest',
    'createBirdCoderUserRouteIntent',
    'createUserRouteIntent',
    'createBirdCoderUserSectionRouteIntent',
    'createUserSectionRouteIntent',
    'userPackageMeta',
    'UserPackageMeta',
  ],
  'sdkwork-birdcoder appbase user bridge',
);

assertExports(
  vipUpstreamSource,
  [
    'SdkworkVipWorkspaceManifest',
    'CreateVipWorkspaceManifestOptions',
    'SdkworkVipRouteIntent',
    'CreateVipRouteIntentOptions',
    'createVipWorkspaceManifest',
    'createVipRouteIntent',
    'vipPackageMeta',
    'VipPackageMeta',
  ],
  'sdkwork-appbase vip reference',
);

assertExports(
  vipLocalSource,
  [
    'BirdCoderVipWorkspaceManifest',
    'CreateBirdCoderVipWorkspaceManifestOptions',
    'BirdCoderVipRouteIntent',
    'CreateBirdCoderVipRouteIntentOptions',
    'createBirdCoderVipWorkspaceManifest',
    'createVipWorkspaceManifest',
    'createBirdCoderVipRouteIntent',
    'createVipRouteIntent',
    'vipPackageMeta',
    'VipPackageMeta',
  ],
  'sdkwork-birdcoder appbase vip bridge',
);

for (const [source, requiredLiteral, label] of [
  [authLocalSource, '@sdkwork/auth-pc-react', 'auth source package'],
  [authLocalSource, '/auth', 'auth base route'],
  [authLocalSource, '/login', 'auth login route'],
  [authLocalSource, '/register', 'auth register route'],
  [authLocalSource, '/forgot-password', 'auth forgot-password route'],
  [authLocalSource, '/oauth/callback/:provider', 'auth oauth callback route'],
  [authLocalSource, '/qr-login', 'auth qr-login route'],
  [userLocalSource, '@sdkwork/user-pc-react', 'user source package'],
  [userLocalSource, '/user', 'user route'],
  [userLocalSource, '/sections/:sectionId', 'user section route pattern'],
  [vipLocalSource, '@sdkwork/vip-pc-react', 'vip source package'],
  [vipLocalSource, '/vip', 'vip route'],
]) {
  assert.match(source, new RegExp(escapeRegExp(requiredLiteral)), `Missing ${label}.`);
}

const architectureDoc = readText(rootDir, 'docs/架构/17-appbase-auth-user-vip-统一接入标准.md');
const stepDoc = readText(rootDir, 'docs/step/14-appbase-auth-user-vip-统一接入实施.md');
const promptDoc = readText(rootDir, 'docs/prompts/反复执行Step指令.md');

for (const retiredModulePath of [
  'packages/sdkwork-birdcoder-auth',
  'packages/sdkwork-birdcoder-auth/package.json',
  'packages/sdkwork-birdcoder-auth/src/index.ts',
  'packages/sdkwork-birdcoder-user',
  'packages/sdkwork-birdcoder-user/package.json',
  'packages/sdkwork-birdcoder-user/src/index.ts',
]) {
  assert.ok(
    !fs.existsSync(path.join(rootDir, retiredModulePath)),
    `Retired standalone module entry must stay removed: ${retiredModulePath}`,
  );
}

for (const [source, label] of [
  [architectureDoc, 'architecture standard'],
  [stepDoc, 'step standard'],
  [promptDoc, 'execution prompt'],
]) {
  assert.match(source, /sdkwork-birdcoder-appbase/, `${label} must name sdkwork-birdcoder-appbase.`);
  assert.match(source, /workspace manifest/i, `${label} must mention workspace manifest.`);
  assert.match(source, /package meta/i, `${label} must mention package meta.`);
}

assert.match(promptDoc, /check:appbase-parity/, 'execution prompt must require check:appbase-parity.');

console.log('sdkwork-appbase parity contract passed.');
