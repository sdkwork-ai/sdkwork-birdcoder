export const DEFAULT_RELEASE_PROFILE_ID = 'sdkwork-birdcoder';
export const RELEASE_ASSET_MANIFEST_FILE_NAME = 'release-asset-manifest.json';

const NATIVE_RELEASE_TARGET_MATRIX = Object.freeze([
  Object.freeze({
    runner: 'windows-2022',
    platform: 'windows',
    arch: 'x64',
    target: 'x86_64-pc-windows-msvc',
    bundles: Object.freeze(['nsis', 'msi']),
  }),
  Object.freeze({
    runner: 'windows-11-arm',
    platform: 'windows',
    arch: 'arm64',
    target: 'aarch64-pc-windows-msvc',
    bundles: Object.freeze(['nsis']),
  }),
  Object.freeze({
    runner: 'ubuntu-24.04',
    platform: 'linux',
    arch: 'x64',
    target: 'x86_64-unknown-linux-gnu',
    bundles: Object.freeze(['deb', 'rpm', 'appimage']),
  }),
  Object.freeze({
    runner: 'ubuntu-24.04-arm',
    platform: 'linux',
    arch: 'arm64',
    target: 'aarch64-unknown-linux-gnu',
    bundles: Object.freeze(['deb', 'appimage']),
  }),
  Object.freeze({
    runner: 'macos-15-intel',
    platform: 'macos',
    arch: 'x64',
    target: 'x86_64-apple-darwin',
    bundles: Object.freeze(['app', 'dmg']),
  }),
  Object.freeze({
    runner: 'macos-15',
    platform: 'macos',
    arch: 'arm64',
    target: 'aarch64-apple-darwin',
    bundles: Object.freeze(['app', 'dmg']),
  }),
]);

const DEPLOYMENT_ACCELERATOR_MATRIX = Object.freeze([
  Object.freeze({
    runner: 'ubuntu-24.04',
    platform: 'linux',
    arch: 'x64',
    target: 'x86_64-unknown-linux-gnu',
    accelerator: 'cpu',
  }),
  Object.freeze({
    runner: 'ubuntu-24.04',
    platform: 'linux',
    arch: 'x64',
    target: 'x86_64-unknown-linux-gnu',
    accelerator: 'nvidia-cuda',
  }),
  Object.freeze({
    runner: 'ubuntu-24.04',
    platform: 'linux',
    arch: 'x64',
    target: 'x86_64-unknown-linux-gnu',
    accelerator: 'amd-rocm',
  }),
  Object.freeze({
    runner: 'ubuntu-24.04-arm',
    platform: 'linux',
    arch: 'arm64',
    target: 'aarch64-unknown-linux-gnu',
    accelerator: 'cpu',
  }),
]);

const SDKWORK_BIRDCODER_RELEASE_PROFILE = Object.freeze({
  id: DEFAULT_RELEASE_PROFILE_ID,
  productName: 'SDKWork BirdCoder',
  releaseName: 'SDKWork BirdCoder',
  desktop: Object.freeze({
    matrix: NATIVE_RELEASE_TARGET_MATRIX,
  }),
  server: Object.freeze({
    binaryName: 'sdkwork-birdcoder-server',
    matrix: NATIVE_RELEASE_TARGET_MATRIX.map((entry) => Object.freeze({
      runner: entry.runner,
      platform: entry.platform,
      arch: entry.arch,
      target: entry.target,
      archiveFormat: 'tar.gz',
    })),
  }),
  container: Object.freeze({
    matrix: DEPLOYMENT_ACCELERATOR_MATRIX,
    bundleFormat: 'tar.gz',
  }),
  kubernetes: Object.freeze({
    matrix: DEPLOYMENT_ACCELERATOR_MATRIX,
    bundleFormat: 'tar.gz',
  }),
  release: Object.freeze({
    manifestFileName: 'release-manifest.json',
    partialManifestFileName: RELEASE_ASSET_MANIFEST_FILE_NAME,
    globalChecksumsFileName: 'SHA256SUMS.txt',
    enableArtifactAttestations: true,
  }),
});

const RELEASE_PROFILES = new Map([
  [SDKWORK_BIRDCODER_RELEASE_PROFILE.id, SDKWORK_BIRDCODER_RELEASE_PROFILE],
]);

export function resolveReleaseProfile(profileId = DEFAULT_RELEASE_PROFILE_ID) {
  const normalizedProfileId = String(profileId ?? '').trim() || DEFAULT_RELEASE_PROFILE_ID;
  const profile = RELEASE_PROFILES.get(normalizedProfileId);
  if (!profile) {
    throw new Error(`Unsupported release profile: ${profileId}`);
  }

  return profile;
}

export function buildDesktopReleaseMatrix(profileId = DEFAULT_RELEASE_PROFILE_ID) {
  return resolveReleaseProfile(profileId).desktop.matrix.map((entry) => ({ ...entry, bundles: [...entry.bundles] }));
}

export function buildServerReleaseMatrix(profileId = DEFAULT_RELEASE_PROFILE_ID) {
  return resolveReleaseProfile(profileId).server.matrix.map((entry) => ({ ...entry }));
}

export function buildContainerReleaseMatrix(profileId = DEFAULT_RELEASE_PROFILE_ID) {
  return resolveReleaseProfile(profileId).container.matrix.map((entry) => ({ ...entry }));
}

export function buildKubernetesReleaseMatrix(profileId = DEFAULT_RELEASE_PROFILE_ID) {
  return resolveReleaseProfile(profileId).kubernetes.matrix.map((entry) => ({ ...entry }));
}
