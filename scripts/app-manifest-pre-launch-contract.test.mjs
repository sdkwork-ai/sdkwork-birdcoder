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
  assert.equal(
    manifest.metadata?.releaseEvidence?.status,
    'blocked',
    `${relativePath} must not claim release readiness while production evidence is missing.`,
  );
  const expectedReleaseBlockers = [
    'signed-production-artifact-evidence-missing',
  ];
  if (manifest.app?.key === 'sdkwork-birdcoder-mini-program') {
    expectedReleaseBlockers.push('wechat-devtools-upload-evidence-missing');
  }
  assert.deepEqual(
    manifest.metadata?.releaseEvidence?.blockers,
    expectedReleaseBlockers,
    `${relativePath} must enumerate the active release blockers.`,
  );
  assert.equal(manifest.release?.defaultChannel, 'INTERNAL');
  assert.equal(manifest.release?.latest?.INTERNAL, manifest.release?.currentVersion);
  assert.equal(manifest.release?.notes?.filter((note) => note.current === true).length, 1);
  assert.equal(manifest.release?.notes?.some((note) => 'publishedAt' in note), false);

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
    assert.equal(
      pkg.metadata?.releaseBuildDeferred,
      true,
      `${relativePath} package ${pkg.id} must declare deferred pre-launch build evidence.`,
    );
    assert.ok(
      ['fixed', 'runtime-configurable'].includes(pkg.profileBinding),
      `${relativePath} package ${pkg.id} must declare a supported profile binding.`,
    );
    if (pkg.profileBinding === 'fixed') {
      assert.equal(typeof pkg.deploymentProfile, 'string');
    } else {
      assert.ok(Array.isArray(pkg.supportedDeploymentProfiles));
      assert.ok(pkg.supportedDeploymentProfiles.length > 0);
    }
    assert.equal(typeof pkg.targetPlatform, 'string');
    assert.equal(typeof pkg.clientArchitecture, 'string');
  }
}

console.log('app manifest pre-launch contract passed.');
