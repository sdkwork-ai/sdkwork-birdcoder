import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');

const appbasePackageSpecifiers = new Set([
  '@sdkwork/appbase-pc-react',
  '@sdkwork/auth-pc-react',
  '@sdkwork/auth-runtime-pc-react',
  '@sdkwork/search-pc-react',
  '@sdkwork/user-center-core-pc-react',
  '@sdkwork/user-center-pc-react',
  '@sdkwork/user-center-validation-pc-react',
  '@sdkwork/user-pc-react',
  '@sdkwork/vip-pc-react',
  '@sdkwork/wallet-pc-react',
]);

const requiredAppbaseTypeBoundaryPaths = new Map([
  ['@sdkwork/appbase-pc-react', 'src/appbase-public-types/appbase-pc-react.d.ts'],
  ['@sdkwork/auth-pc-react', 'src/appbase-public-types/auth-pc-react.d.ts'],
  ['@sdkwork/auth-runtime-pc-react', 'src/appbase-public-types/auth-runtime-pc-react.d.ts'],
  ['@sdkwork/search-pc-react', 'src/appbase-public-types/search-pc-react.d.ts'],
  [
    '@sdkwork/user-center-core-pc-react',
    'src/appbase-public-types/user-center-core-pc-react.d.ts',
  ],
  ['@sdkwork/user-center-pc-react', 'src/appbase-public-types/user-center-pc-react.d.ts'],
  [
    '@sdkwork/user-center-validation-pc-react',
    'src/appbase-public-types/user-center-validation-pc-react.d.ts',
  ],
  ['@sdkwork/user-pc-react', 'src/appbase-public-types/user-pc-react.d.ts'],
  ['@sdkwork/vip-pc-react', 'src/appbase-public-types/vip-pc-react.d.ts'],
  ['@sdkwork/wallet-pc-react', 'src/appbase-public-types/wallet-pc-react.d.ts'],
]);

const tsconfigRelativePaths = [
  'tsconfig.json',
  'packages/sdkwork-birdcoder-auth/tsconfig.json',
  'packages/sdkwork-birdcoder-user/tsconfig.json',
  'packages/sdkwork-birdcoder-server/tsconfig.json',
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workspaceRoot, relativePath), 'utf8'));
}

for (const relativePath of tsconfigRelativePaths) {
  const tsconfig = readJson(relativePath);
  const paths = tsconfig.compilerOptions?.paths ?? {};

  for (const specifier of appbasePackageSpecifiers) {
    const configuredTargets = paths[specifier];
    if (relativePath === 'tsconfig.json') {
      assert.deepEqual(
        configuredTargets,
        [requiredAppbaseTypeBoundaryPaths.get(specifier)],
        `${relativePath} must map ${specifier} to the BirdCoder-owned public type boundary only.`,
      );
      continue;
    }

    assert.equal(
      configuredTargets,
      undefined,
      `${relativePath} must not override ${specifier}; appbase IAM packages inherit the root BirdCoder public type boundary.`,
    );
  }

  for (const [specifier, targets] of Object.entries(paths)) {
    for (const target of targets ?? []) {
      assert.doesNotMatch(
        String(target).replace(/\\/gu, '/'),
        /\.\.\/sdkwork-appbase\/packages\/.*\/src(?:\/index\.(?:ts|tsx))?$/u,
        `${relativePath} must not map ${specifier} directly into sdkwork-appbase source paths.`,
      );
    }
  }
}

for (const [specifier, boundaryRelativePath] of requiredAppbaseTypeBoundaryPaths) {
  const absoluteBoundaryPath = path.join(workspaceRoot, boundaryRelativePath);
  assert.equal(
    fs.existsSync(absoluteBoundaryPath),
    true,
    `${specifier} must have a BirdCoder-owned public type boundary at ${boundaryRelativePath}.`,
  );

  const boundarySource = fs.readFileSync(absoluteBoundaryPath, 'utf8');
  assert.doesNotMatch(
    boundarySource.replace(/\\/gu, '/'),
    /\.\.\/sdkwork-appbase\/|sdkwork-appbase\/packages\/.*\/src|@sdkwork\/[^'"]+\/src/u,
    `${boundaryRelativePath} must not import sdkwork-appbase source paths or package /src internals.`,
  );
}

console.log('appbase package boundary contract passed.');
