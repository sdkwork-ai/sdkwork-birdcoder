import path from 'node:path';

export const PC_WEB_DIST_REL = 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/dist';
export const PC_DESKTOP_DIST_REL = 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/dist';
export const PC_DESKTOP_TAURI_REL = 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src-tauri';
export const WORKSPACE_CARGO_TARGET_REL = 'target';
export const SERVER_CRATE_BINARY_NAME = 'sdkwork-birdcoder-api-server';

export function resolveReleaseBuildPath(rootDir, relativePath) {
  return path.join(rootDir, relativePath);
}

export function resolveServerBinaryFileName(binaryName, { targetTriple = '', platform = '' } = {}) {
  const normalizedBinaryName = String(binaryName ?? '').trim();
  const normalizedTargetTriple = String(targetTriple ?? '').trim().toLowerCase();
  const normalizedPlatform = String(platform ?? '').trim().toLowerCase();
  if (
    (normalizedTargetTriple.includes('windows')
      || normalizedPlatform === 'windows'
      || normalizedPlatform === 'win32')
    && !normalizedBinaryName.toLowerCase().endsWith('.exe')
  ) {
    return `${normalizedBinaryName}.exe`;
  }

  return normalizedBinaryName;
}

export function resolveServerBinaryCandidates(rootDir, descriptor, binaryName = SERVER_CRATE_BINARY_NAME) {
  const binaryFileName = resolveServerBinaryFileName(binaryName, {
    targetTriple: descriptor?.target,
    platform: descriptor?.platform,
  });
  const serverTargetRoot = resolveReleaseBuildPath(rootDir, WORKSPACE_CARGO_TARGET_REL);
  const candidatePaths = [];
  const normalizedTarget = String(descriptor?.target ?? '').trim();
  if (normalizedTarget) {
    candidatePaths.push(path.join(serverTargetRoot, normalizedTarget, 'release', binaryFileName));
  }
  candidatePaths.push(path.join(serverTargetRoot, 'release', binaryFileName));
  return { binaryFileName, candidatePaths };
}

export function resolveDesktopBundleOutputRoot(rootDir, target = '') {
  const targetRoot = resolveReleaseBuildPath(rootDir, path.join(PC_DESKTOP_TAURI_REL, 'target'));
  const normalizedTarget = String(target ?? '').trim();
  if (normalizedTarget) {
    return path.join(targetRoot, normalizedTarget, 'release', 'bundle');
  }

  return path.join(targetRoot, 'release', 'bundle');
}
