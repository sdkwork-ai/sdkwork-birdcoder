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

function readAppbaseJson(relativePath) {
  return JSON.parse(readAppbaseText(relativePath));
}

const authPackageJson = readJson('packages/sdkwork-birdcoder-auth/package.json');
const authTsconfig = readJson('packages/sdkwork-birdcoder-auth/tsconfig.json');
const userPackageJson = readJson('packages/sdkwork-birdcoder-user/package.json');
const userTsconfig = readJson('packages/sdkwork-birdcoder-user/tsconfig.json');
const authPageSource = readText('packages/sdkwork-birdcoder-auth/src/pages/AuthPage.tsx');
const vitePluginSource = readText('scripts/create-birdcoder-vite-plugins.mjs');
const shellStylesheetSource = readText('packages/sdkwork-birdcoder-shell/src/styles/index.css');
const workspacePackageJson = readJson('package.json');
const sharedAuthPackageJson = readAppbaseJson('packages/pc-react/identity/sdkwork-auth-pc-react/package.json');
const sharedUserCenterPackageJson = readAppbaseJson(
  'packages/pc-react/identity/sdkwork-user-center-pc-react/package.json',
);
const sharedAuthPageSource = readAppbaseText('packages/pc-react/identity/sdkwork-auth-pc-react/src/pages/AuthPage.tsx');
const sharedAuthShellSource = readAppbaseText('packages/pc-react/identity/sdkwork-auth-pc-react/src/components/auth-page-shell.tsx');

assert.equal(
  authPackageJson.dependencies?.['@sdkwork/auth-pc-react'],
  'link:../../../sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react',
  'sdkwork-birdcoder-auth must declare the canonical @sdkwork/auth-pc-react package directly.',
);

assert.equal(
  authPackageJson.dependencies?.['@sdkwork/ui-pc-react'],
  'file:../../../sdkwork-ui/sdkwork-ui-pc-react',
  'sdkwork-birdcoder-auth must declare the shared @sdkwork/ui-pc-react package required by shared auth UI.',
);

assert.equal(
  authPackageJson.dependencies?.['@sdkwork/user-center-pc-react'],
  'link:../../../sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-pc-react',
  'sdkwork-birdcoder-auth must declare the canonical @sdkwork/user-center-pc-react package directly.',
);

assert.deepEqual(
  authTsconfig.compilerOptions?.paths?.['@sdkwork/auth-pc-react'],
  ['../sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/index.ts'],
  'sdkwork-birdcoder-auth tsconfig must map @sdkwork/auth-pc-react to the canonical shared auth root entry.',
);

assert.deepEqual(
  authTsconfig.compilerOptions?.paths?.['@sdkwork/user-center-pc-react'],
  ['../sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-pc-react/src/index.ts'],
  'sdkwork-birdcoder-auth tsconfig must map @sdkwork/user-center-pc-react to the canonical shared user-center root entry.',
);

assert.deepEqual(
  userTsconfig.compilerOptions?.paths?.['@sdkwork/user-pc-react'],
  ['../sdkwork-appbase/packages/pc-react/identity/sdkwork-user-pc-react/src/index.ts'],
  'sdkwork-birdcoder-user tsconfig must map @sdkwork/user-pc-react to the canonical shared user root entry.',
);

assert.equal(
  userPackageJson.dependencies?.['@sdkwork/user-pc-react'],
  'link:../../../sdkwork-appbase/packages/pc-react/identity/sdkwork-user-pc-react',
  'sdkwork-birdcoder-user must declare the canonical @sdkwork/user-pc-react package directly.',
);

assert.equal(
  userPackageJson.dependencies?.['@sdkwork/user-center-pc-react'],
  'link:../../../sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-pc-react',
  'sdkwork-birdcoder-user must declare the canonical @sdkwork/user-center-pc-react package directly.',
);

assert.deepEqual(
  sharedAuthPackageJson.exports?.['.'],
  {
    types: './src/index.ts',
    import: './src/index.ts',
    default: './src/index.ts',
  },
  'sdkwork-auth-pc-react must publish the canonical root entry for embedded host applications.',
);

assert.equal(
  sharedAuthPackageJson.exports?.['./surface'],
  undefined,
  'sdkwork-auth-pc-react must not publish subpath surface exports; root-package imports are the only standard.',
);

const sharedUserPackageJson = readAppbaseJson('packages/pc-react/identity/sdkwork-user-pc-react/package.json');

assert.deepEqual(
  sharedUserPackageJson.exports?.['.'],
  {
    types: './src/index.ts',
    import: './src/index.ts',
    default: './src/index.ts',
  },
  'sdkwork-user-pc-react must publish the canonical root entry for embedded host applications.',
);

assert.equal(
  sharedUserPackageJson.exports?.['./surface'],
  undefined,
  'sdkwork-user-pc-react must not publish subpath surface exports; root-package imports are the only standard.',
);

assert.deepEqual(
  sharedUserCenterPackageJson.exports?.['.'],
  {
    types: './src/index.ts',
    import: './src/index.ts',
    default: './src/index.ts',
  },
  'sdkwork-user-center-pc-react must publish the canonical root entry for embedded host applications.',
);

assert.match(
  sharedAuthPageSource,
  /components\/auth\/AccountPasswordLoginForm\.tsx/u,
  'sdkwork-auth-pc-react must keep the claw-aligned account-password form extracted into the shared auth component layer.',
);

assert.match(
  sharedAuthPageSource,
  /components\/auth\/RegisterFlow\.tsx/u,
  'sdkwork-auth-pc-react must keep the claw-aligned register flow extracted into the shared auth component layer.',
);

assert.match(
  sharedAuthShellSource,
  /rounded-\[32px\]/u,
  'sdkwork-auth-pc-react shell must keep the claw-aligned rounded auth workspace container.',
);

assert.match(
  authPageSource,
  /from ['"]@sdkwork\/user-center-pc-react['"]/u,
  'BirdCoder auth page must import the canonical shared user-center root entry.',
);

assert.doesNotMatch(
  authPageSource,
  /from ['"]@sdkwork\/user-center-pc-react\/.+['"]/u,
  'BirdCoder auth page must not import @sdkwork/user-center-pc-react subpath entries directly.',
);

assert.match(
  authPageSource,
  /createSdkworkCanonicalAuthSurfacePage/u,
  'BirdCoder auth page must render the shared canonical auth surface factory from sdkwork-appbase.',
);

assert.match(
  authPageSource,
  /\.\.\/auth-surface(?:\.ts)?/u,
  'BirdCoder auth page must delegate controller assembly to the split auth surface adapter.',
);

assert.match(
  vitePluginSource,
  /find: ['"]@sdkwork\/auth-pc-react['"]/u,
  'BirdCoder Vite aliases must resolve @sdkwork/auth-pc-react from the sdkwork-appbase source tree.',
);

assert.match(
  vitePluginSource,
  /find: ['"]@sdkwork\/user-center-pc-react['"]/u,
  'BirdCoder Vite aliases must resolve @sdkwork/user-center-pc-react from the sdkwork-appbase source tree.',
);

assert.match(
  shellStylesheetSource,
  /sdkwork-appbase\/packages\/pc-react\/identity\/sdkwork-auth-pc-react\/src/u,
  'BirdCoder shell stylesheet must scan the shared auth source tree for Tailwind classes.',
);

assert.match(
  shellStylesheetSource,
  /sdkwork-ui\/sdkwork-ui-pc-react\/src/u,
  'BirdCoder shell stylesheet must scan the shared UI source tree required by shared auth components.',
);

assert.match(
  workspacePackageJson.scripts?.['check:identity-standard'] ?? '',
  /auth-ui-standard-contract\.test\.mjs/u,
  'BirdCoder parity checks must include the auth UI standard contract.',
);

console.log('birdcoder auth ui standard contract passed.');
