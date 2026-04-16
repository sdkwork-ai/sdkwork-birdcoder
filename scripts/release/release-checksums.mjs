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

export function writeReleaseChecksums({
  releaseAssetsDir,
  checksumFileName = 'SHA256SUMS.txt',
} = {}) {
  const normalizedReleaseAssetsDir = path.resolve(String(releaseAssetsDir ?? '').trim() || '.');
  const normalizedChecksumFileName = String(checksumFileName ?? '').trim() || 'SHA256SUMS.txt';
  const checksumsPath = path.join(normalizedReleaseAssetsDir, normalizedChecksumFileName);

  const checksumTargets = walkFiles(normalizedReleaseAssetsDir)
    .filter((filePath) => path.resolve(filePath) !== path.resolve(checksumsPath));
  const checksumLines = checksumTargets.map((filePath) => {
    const digest = computeSha256(filePath);
    const relativePath = toRelativePath(normalizedReleaseAssetsDir, filePath);
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
} = {}) {
  const normalizedReleaseAssetsDir = path.resolve(String(releaseAssetsDir ?? '').trim() || '.');
  const normalizedChecksumFileName = String(checksumFileName ?? '').trim() || 'SHA256SUMS.txt';
  const checksumsPath = path.join(normalizedReleaseAssetsDir, normalizedChecksumFileName);
  if (!fs.existsSync(checksumsPath)) {
    return null;
  }

  return writeReleaseChecksums({
    releaseAssetsDir: normalizedReleaseAssetsDir,
    checksumFileName: normalizedChecksumFileName,
  });
}
