import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  refreshReleaseChecksumsIfPresent,
  writeReleaseChecksums,
} from './release-checksums.mjs';

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-checksums-'));
const releaseAssetsDir = path.join(fixtureRoot, 'release-assets');
fs.mkdirSync(path.join(releaseAssetsDir, 'server', 'windows', 'x64'), { recursive: true });

const artifactRelativePath = 'server/windows/x64/server.tar.gz';
const artifactContent = Buffer.from('publishable server archive\n', 'utf8');
fs.writeFileSync(path.join(releaseAssetsDir, artifactRelativePath), artifactContent);
fs.writeFileSync(path.join(releaseAssetsDir, 'release-notes.md'), '# Release Notes\n');
fs.writeFileSync(
  path.join(releaseAssetsDir, 'finalized-release-smoke-report.json'),
  JSON.stringify({ status: 'passed' }, null, 2),
);
fs.writeFileSync(
  path.join(releaseAssetsDir, 'release-manifest.json'),
  JSON.stringify({
    checksumFileName: 'SHA256SUMS.txt',
    artifacts: [
      {
        relativePath: artifactRelativePath,
        sha256: sha256(artifactContent),
        size: artifactContent.length,
      },
    ],
  }, null, 2),
);
fs.writeFileSync(path.join(releaseAssetsDir, 'SHA256SUMS.txt'), 'stale  release-notes.md\n');

const refreshed = refreshReleaseChecksumsIfPresent({
  releaseAssetsDir,
  checksumFileName: 'SHA256SUMS.txt',
});
assert.equal(refreshed?.checksumCount, 1);
assert.equal(
  fs.readFileSync(path.join(releaseAssetsDir, 'SHA256SUMS.txt'), 'utf8'),
  `${sha256(artifactContent)}  ${artifactRelativePath}\n`,
  'refreshing a finalized release directory must preserve the manifest artifacts publication view',
);

const allFilesDir = path.join(fixtureRoot, 'all-files');
fs.mkdirSync(allFilesDir, { recursive: true });
fs.writeFileSync(path.join(allFilesDir, 'alpha.txt'), 'alpha');
fs.writeFileSync(path.join(allFilesDir, 'beta.txt'), 'beta');
const allFilesResult = writeReleaseChecksums({
  releaseAssetsDir: allFilesDir,
  checksumFileName: 'SHA256SUMS.txt',
});
assert.equal(allFilesResult.checksumCount, 2);
assert.match(fs.readFileSync(path.join(allFilesDir, 'SHA256SUMS.txt'), 'utf8'), /alpha\.txt/);
assert.match(fs.readFileSync(path.join(allFilesDir, 'SHA256SUMS.txt'), 'utf8'), /beta\.txt/);

console.log('release checksums contract passed.');
