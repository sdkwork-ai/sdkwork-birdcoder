import assert from 'node:assert/strict';
import path from 'node:path';

import {
  listSdkworkAppManifestPaths,
  readSdkworkAppManifest,
} from './lib/sdkwork-app-manifest-paths.mjs';

const rootDir = process.cwd();

for (const manifestPath of listSdkworkAppManifestPaths(rootDir)) {
  const relativePath = path.relative(rootDir, manifestPath);
  const manifest = readSdkworkAppManifest(manifestPath);

  assert.equal(
    manifest.publish?.status,
    'DRAFT',
    `${relativePath} publish.status must stay DRAFT until the first governed release.`,
  );
  assert.equal(
    manifest.publish?.preLaunch,
    true,
    `${relativePath} publish.preLaunch must remain true until real artifacts ship.`,
  );
  assert.equal(
    manifest.metadata?.preLaunch,
    true,
    `${relativePath} metadata.preLaunch must remain true until real artifacts ship.`,
  );

  assert.equal(manifest.security?.checksumRequired, true, `${relativePath} must require checksums.`);
  assert.equal(manifest.security?.signatureRequired, true, `${relativePath} must require signatures.`);
  assert.equal(manifest.security?.sbomRequired, true, `${relativePath} must require SBOM evidence.`);

  const packages = manifest.artifacts?.installConfig?.packages ?? [];
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
    assert.equal(
      pkg.metadata?.preLaunch,
      true,
      `${relativePath} package ${pkg.id} must declare preLaunch metadata.`,
    );
    assert.equal(
      pkg.metadata?.artifactPending,
      true,
      `${relativePath} package ${pkg.id} must declare artifactPending metadata.`,
    );
  }
}

console.log('app manifest pre-launch contract passed.');
