import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function walkFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  const files = [];
  const stack = [directoryPath];
  while (stack.length > 0) {
    const currentPath = stack.pop();
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }

      files.push(absolutePath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function computeSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function toRelativePath(baseDir, targetPath) {
  return path.relative(baseDir, targetPath).split(path.sep).join('/');
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeManifestArtifactTargets({
  releaseAssetsDir,
  manifestFileName = 'release-manifest.json',
} = {}) {
  const manifestPath = path.join(releaseAssetsDir, manifestFileName);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  const manifest = readJsonFile(manifestPath);
  const artifactTargets = Array.isArray(manifest?.artifacts)
    ? manifest.artifacts
      .map((artifact) => String(artifact?.relativePath ?? '').trim().replaceAll('\\', '/'))
      .filter(Boolean)
    : [];
  if (artifactTargets.length === 0) {
    return null;
  }

  return artifactTargets.map((relativePath) => {
    if (
      path.posix.isAbsolute(relativePath)
      || path.win32.isAbsolute(relativePath)
      || relativePath.split('/').includes('..')
    ) {
      throw new Error(`Release manifest contains an unsafe artifact path: ${relativePath}`);
    }

    const absolutePath = path.join(releaseAssetsDir, relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Missing release artifact referenced by release-manifest.json: ${relativePath}`);
    }

    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) {
      throw new Error(`Release artifact referenced by release-manifest.json is not a file: ${relativePath}`);
    }

    return {
      absolutePath,
      relativePath,
    };
  });
}

export function writeReleaseChecksums({
  releaseAssetsDir,
  checksumFileName = 'SHA256SUMS.txt',
  targets = null,
} = {}) {
  const normalizedReleaseAssetsDir = path.resolve(String(releaseAssetsDir ?? '').trim() || '.');
  const normalizedChecksumFileName = String(checksumFileName ?? '').trim() || 'SHA256SUMS.txt';
  const checksumsPath = path.join(normalizedReleaseAssetsDir, normalizedChecksumFileName);

  const checksumTargets = Array.isArray(targets) && targets.length > 0
    ? targets
    : walkFiles(normalizedReleaseAssetsDir)
      .filter((filePath) => path.resolve(filePath) !== path.resolve(checksumsPath))
      .map((filePath) => ({
        absolutePath: filePath,
        relativePath: toRelativePath(normalizedReleaseAssetsDir, filePath),
      }));
  const checksumLines = checksumTargets.map((target) => {
    const absolutePath = path.resolve(String(target?.absolutePath ?? '').trim());
    const relativePath = String(target?.relativePath ?? '').trim().replaceAll('\\', '/');
    const digest = computeSha256(absolutePath);
    return `${digest}  ${relativePath}`;
  });

  fs.writeFileSync(checksumsPath, `${checksumLines.join('\n')}\n`, 'utf8');

  return {
    checksumsPath,
    checksumCount: checksumLines.length,
  };
}

export function refreshReleaseChecksumsIfPresent({
  releaseAssetsDir,
  checksumFileName = 'SHA256SUMS.txt',
  manifestFileName = 'release-manifest.json',
} = {}) {
  const normalizedReleaseAssetsDir = path.resolve(String(releaseAssetsDir ?? '').trim() || '.');
  const normalizedChecksumFileName = String(checksumFileName ?? '').trim() || 'SHA256SUMS.txt';
  const checksumsPath = path.join(normalizedReleaseAssetsDir, normalizedChecksumFileName);
  if (!fs.existsSync(checksumsPath)) {
    return null;
  }

  const manifestArtifactTargets = normalizeManifestArtifactTargets({
    releaseAssetsDir: normalizedReleaseAssetsDir,
    manifestFileName,
  });

  return writeReleaseChecksums({
    releaseAssetsDir: normalizedReleaseAssetsDir,
    checksumFileName: normalizedChecksumFileName,
    targets: manifestArtifactTargets,
  });
}
