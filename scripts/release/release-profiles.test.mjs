import assert from 'node:assert/strict';

import {
  DEFAULT_RELEASE_PROFILE_ID,
  RELEASE_ASSET_MANIFEST_FILE_NAME,
  buildContainerReleaseMatrix,
  buildDesktopReleaseMatrix,
  buildKubernetesReleaseMatrix,
  buildServerReleaseMatrix,
  resolveReleaseProfile,
} from './release-profiles.mjs';

const profile = resolveReleaseProfile();

assert.equal(DEFAULT_RELEASE_PROFILE_ID, 'sdkwork-birdcoder');
assert.equal(RELEASE_ASSET_MANIFEST_FILE_NAME, 'release-asset-manifest.json');
assert.equal(profile.id, 'sdkwork-birdcoder');
assert.equal(profile.productName, 'SDKWork BirdCoder');
assert.equal(profile.release.partialManifestFileName, 'release-asset-manifest.json');
assert.equal(profile.release.manifestChecksumFileName, 'release-manifest.json.sha256.txt');
assert.equal(profile.release.attestationEvidenceFileName, 'release-attestations.json');
assert.equal(profile.release.attestationPredicateType, 'https://slsa.dev/provenance/v1');
assert.equal(profile.release.attestationSignerWorkflowPath, '.github/workflows/release-reusable.yml');
assert.equal(profile.release.enableArtifactAttestations, true);

const desktopMatrix = buildDesktopReleaseMatrix();
assert.ok(desktopMatrix.some((entry) => entry.platform === 'windows' && entry.arch === 'x64'));
assert.ok(desktopMatrix.some((entry) => entry.platform === 'windows' && entry.arch === 'arm64'));
assert.ok(desktopMatrix.some((entry) => entry.platform === 'linux' && entry.arch === 'x64'));
assert.ok(desktopMatrix.some((entry) => entry.platform === 'linux' && entry.arch === 'arm64'));
assert.ok(desktopMatrix.some((entry) => entry.platform === 'macos' && entry.arch === 'x64'));
assert.ok(desktopMatrix.some((entry) => entry.platform === 'macos' && entry.arch === 'arm64'));

const serverMatrix = buildServerReleaseMatrix();
assert.equal(serverMatrix.length, desktopMatrix.length);

const containerMatrix = buildContainerReleaseMatrix();
assert.ok(containerMatrix.some((entry) => entry.accelerator === 'cpu'));
assert.ok(containerMatrix.some((entry) => entry.accelerator === 'nvidia-cuda'));
assert.ok(containerMatrix.some((entry) => entry.accelerator === 'amd-rocm'));

const kubernetesMatrix = buildKubernetesReleaseMatrix();
assert.deepEqual(
  kubernetesMatrix.map((entry) => `${entry.platform}-${entry.arch}-${entry.accelerator}`),
  containerMatrix.map((entry) => `${entry.platform}-${entry.arch}-${entry.accelerator}`),
);

console.log('release profiles contract passed.');
