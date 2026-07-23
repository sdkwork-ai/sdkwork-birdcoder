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
const releaseBlockers = [
  'signed-production-artifact-evidence-missing',
];

const expectedSurfacePackages = {
  'apps/sdkwork-birdcoder-pc/sdkwork.app.config.json': [
    ['WEB', 'browser', 'web', 'pc-web'],
    ['DESKTOP_WINDOWS', 'desktop', 'windows', 'tauri'],
    ['DESKTOP_MACOS', 'desktop', 'macos', 'tauri'],
    ['DESKTOP_LINUX', 'desktop', 'linux', 'tauri'],
  ],
  'apps/sdkwork-birdcoder-h5/sdkwork.app.config.json': [
    ['H5', 'browser', 'h5', 'h5'],
    ['APP_IOS', 'capacitor-ios', 'ios', 'capacitor'],
    ['APP_ANDROID', 'capacitor-android', 'android', 'capacitor'],
  ],
  'apps/sdkwork-birdcoder-flutter-mobile/sdkwork.app.config.json': [
    ['APP_ANDROID', 'flutter-android', 'android', 'flutter'],
    ['APP_IOS', 'flutter-ios', 'ios', 'flutter'],
  ],
};

const discoveredPaths = listSdkworkAppManifestPaths(rootDir).map((absolutePath) =>
  path.relative(rootDir, absolutePath).split(path.sep).join('/'),
);
assert.deepEqual(discoveredPaths.sort(), [...requiredManifestPaths].sort());

for (const relativePath of requiredManifestPaths) {
  const manifest = readSdkworkAppManifest(path.join(rootDir, relativePath));
  const currentNotes = manifest.release?.notes?.filter((note) => note.current === true) ?? [];
  const packages = manifest.artifacts?.installConfig?.packages ?? [];

  assert.equal(manifest.publish?.status, 'DRAFT', `${relativePath} must remain DRAFT.`);
  assert.equal(manifest.publish?.preLaunch, true, `${relativePath} must remain pre-launch.`);
  assert.equal(manifest.metadata?.preLaunch, true, `${relativePath} metadata must remain pre-launch.`);
  assert.equal(manifest.metadata?.deploymentConfig, 'etc/sdkwork.deployment.config.json');
  assert.deepEqual(manifest.metadata?.releaseEvidence, {
    status: 'blocked',
    verifiedAt: '2026-07-22',
    blockers: releaseBlockers,
  });
  assert.equal(manifest.release?.currentVersion, '0.1.0');
  assert.equal(manifest.release?.defaultChannel, 'INTERNAL');
  assert.deepEqual(manifest.release?.latest, { INTERNAL: '0.1.0' });
  assert.equal(currentNotes.length, 1);
  assert.equal(currentNotes[0].releaseChannel, 'INTERNAL');
  assert.equal('publishedAt' in currentNotes[0], false);
  assert.deepEqual([...currentNotes[0].packageIds].sort(), packages.map((pkg) => pkg.id).sort());
  assert.equal(manifest.security?.checksumRequired, true);
  assert.equal(manifest.security?.signatureRequired, true);
  assert.equal(manifest.security?.sbomRequired, true);

  for (const pkg of packages) {
    assert.equal(pkg.enabled, false, `${relativePath} package ${pkg.id} must remain disabled.`);
    assert.equal(pkg.checksum, undefined, `${relativePath} package ${pkg.id} must not use a placeholder checksum.`);
    assert.equal(pkg.profileBinding, 'fixed');
    assert.equal(pkg.metadata?.releaseBuildDeferred, true);
  }

  const expectedPackages = expectedSurfacePackages[relativePath];
  if (expectedPackages) {
    assert.deepEqual(
      packages.map((pkg) => [
        pkg.platform,
        pkg.runtimeTarget,
        pkg.targetPlatform,
        pkg.clientArchitecture,
      ]),
      expectedPackages,
    );
  }
}

const rootManifest = readSdkworkAppManifest(path.join(rootDir, 'sdkwork.app.config.json'));
assert.deepEqual(rootManifest.metadata?.domainOwnership?.apiOperationCounts, {
  appApi: 4,
  backendApi: 0,
  openApi: 0,
});
assert.equal(rootManifest.metadata?.domainOwnership?.databaseTableCount, 0);
assert.equal(rootManifest.metadata?.domainOwnership?.permissionCount, 4);

console.log('surface manifest parity contract passed.');
