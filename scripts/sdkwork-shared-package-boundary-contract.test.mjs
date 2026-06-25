import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');

const sharedPackageSpecifiers = new Set([
  '@sdkwork/appbase-pc-react',
  '@sdkwork/auth-pc-react',
  '@sdkwork/search-pc-react',
  '@sdkwork/user-pc-react',
  '@sdkwork/wallet-pc-react',
]);

const requiredSharedTypeBoundaryPaths = new Map([
  ['@sdkwork/appbase-pc-react', 'apps/sdkwork-birdcoder-pc/src/appbase-public-types/appbase-pc-react.d.ts'],
  ['@sdkwork/auth-pc-react', 'apps/sdkwork-birdcoder-pc/src/appbase-public-types/auth-pc-react.d.ts'],
  ['@sdkwork/search-pc-react', 'apps/sdkwork-birdcoder-pc/src/appbase-public-types/search-pc-react.d.ts'],
  ['@sdkwork/user-pc-react', 'apps/sdkwork-birdcoder-pc/src/appbase-public-types/user-pc-react.d.ts'],
  ['@sdkwork/wallet-pc-react', 'apps/sdkwork-birdcoder-pc/src/appbase-public-types/wallet-pc-react.d.ts'],
]);

const tsconfigRelativePaths = [
  'tsconfig.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/tsconfig.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/tsconfig.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/tsconfig.json',
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workspaceRoot, relativePath), 'utf8'));
}

for (const relativePath of tsconfigRelativePaths) {
  const tsconfig = readJson(relativePath);
  const paths = tsconfig.compilerOptions?.paths ?? {};

  for (const specifier of sharedPackageSpecifiers) {
    const configuredTargets = paths[specifier];
    if (relativePath === 'tsconfig.json') {
      assert.deepEqual(
        configuredTargets,
        [requiredSharedTypeBoundaryPaths.get(specifier)],
        `${relativePath} must map ${specifier} to the BirdCoder-owned public type boundary only.`,
      );
      continue;
    }

    assert.equal(
      configuredTargets,
      undefined,
      `${relativePath} must not override ${specifier}; shared SDKWork packages inherit the root BirdCoder public type boundary.`,
    );
  }

  for (const [specifier, targets] of Object.entries(paths)) {
    for (const target of targets ?? []) {
      const normalizedTarget = String(target).replace(/\\/gu, '/');
      if (/\.\.\/sdkwork-appbase\/packages\/.*\/src(?:\/index\.(?:ts|tsx))?$/u.test(normalizedTarget)) {
        const allowedDirectMappings = [
          '@sdkwork/auth-runtime-pc-react',
          '@sdkwork/iam-contracts',
          '@sdkwork/iam-runtime',
          '@sdkwork/iam-service',
          '@sdkwork/iam-sdk-ports',
          '@sdkwork/runtime-bootstrap',
          '@sdkwork/iam-app-sdk',
          '@sdkwork/iam-backend-sdk',
        ];
        assert.ok(
          allowedDirectMappings.includes(specifier),
          `${relativePath} must not map ${specifier} directly into sdkwork-appbase source paths.`,
        );
      }
    }
  }
}

for (const [specifier, boundaryRelativePath] of requiredSharedTypeBoundaryPaths) {
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

console.log('sdkwork shared package boundary contract passed.');
