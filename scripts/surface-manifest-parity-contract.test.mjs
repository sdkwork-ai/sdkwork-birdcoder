import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  listSdkworkAppManifestPaths,
  readSdkworkAppManifest,
} from './lib/sdkwork-app-manifest-paths.mjs';

const rootDir = process.cwd();

const requiredManifestPaths = [
  'sdkwork.app.config.json',
  'apps/sdkwork-birdcoder-pc/sdkwork.app.config.json',
  'apps/sdkwork-birdcoder-h5/sdkwork.app.config.json',
  'apps/sdkwork-birdcoder-flutter-mobile/sdkwork.app.config.json',
];

for (const relativePath of requiredManifestPaths) {
  assert.equal(
    fs.existsSync(path.join(rootDir, relativePath)),
    true,
    `${relativePath} must exist for unified surface manifest parity.`,
  );
}

const discoveredPaths = listSdkworkAppManifestPaths(rootDir).map((absolutePath) =>
  path.relative(rootDir, absolutePath).split(path.sep).join('/'),
);

for (const relativePath of requiredManifestPaths) {
  assert.ok(
    discoveredPaths.includes(relativePath),
    `${relativePath} must be discovered by listSdkworkAppManifestPaths for preLaunch governance.`,
  );
}

for (const relativePath of requiredManifestPaths) {
  const manifest = readSdkworkAppManifest(path.join(rootDir, relativePath));
  assert.equal(
    manifest.publish?.status,
    'DRAFT',
    `${relativePath} must stay DRAFT until the first governed release.`,
  );
  assert.equal(
    manifest.publish?.preLaunch,
    true,
    `${relativePath} must declare publish.preLaunch while artifacts are pending.`,
  );
  assert.equal(
    manifest.metadata?.preLaunch,
    true,
    `${relativePath} must declare metadata.preLaunch while artifacts are pending.`,
  );
  assert.match(
    String(manifest.metadata?.releaseEvidenceStatus ?? ''),
    /contract-gates-green/u,
    `${relativePath} must record contract-gates-green release evidence.`,
  );
  assert.match(
    String(manifest.metadata?.releaseEvidenceStatus ?? ''),
    /prelaunch-artifacts-pending/u,
    `${relativePath} must record prelaunch-artifacts-pending honesty.`,
  );

  const packages = manifest.artifacts?.installConfig?.packages ?? [];
  if (packages.length > 0) {
    assert.equal(
      manifest.security?.checksumRequired,
      true,
      `${relativePath} must require checksums when install packages are declared.`,
    );
    for (const pkg of packages) {
      assert.equal(
        pkg.enabled,
        false,
        `${relativePath} package ${pkg.id} must stay disabled until real release artifacts exist.`,
      );
      assert.equal(
        pkg.checksum,
        undefined,
        `${relativePath} package ${pkg.id} must not ship placeholder checksum values.`,
      );
    }
  }
}

const rootManifest = readSdkworkAppManifest(path.join(rootDir, 'sdkwork.app.config.json'));
assert.match(
  String(rootManifest.metadata?.commercialReadiness?.pcPrivateBeta ?? ''),
  /http-openapi-157-route-catalog-158/u,
  'Root manifest must record HTTP OpenAPI 157-operation alignment and 158-entry route catalog truth.',
);
assert.match(
  String(rootManifest.metadata?.commercialReadiness?.mobileProductParity ?? ''),
  /chat/u,
  'Root manifest must record mobile chat API alignment.',
);
assert.match(
  String(rootManifest.metadata?.commercialReadiness?.manifestHonesty ?? ''),
  /pc|h5|flutter/u,
  'Root manifest must record PC/H5/Flutter manifest honesty.',
);

console.log('surface manifest parity contract passed.');
