import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { smokeReleaseAssets } from './smoke-release-assets.mjs';

assert.throws(() => smokeReleaseAssets({}), /A release family is required/);
assert.throws(
  () => smokeReleaseAssets({ family: 'web' }),
  /A release assets directory is required/,
);

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-smoke-'));
const webDir = path.join(releaseAssetsDir, 'web');
fs.mkdirSync(webDir, { recursive: true });
fs.writeFileSync(path.join(webDir, 'sdkwork-birdcoder-web-release-local.tar.gz'), 'tar');
fs.writeFileSync(
  path.join(webDir, 'release-asset-manifest.json'),
  JSON.stringify({
    family: 'web',
    archiveRelativePath: 'web/sdkwork-birdcoder-web-release-local.tar.gz',
    artifacts: [
      { relativePath: 'web/app/index.html' },
      { relativePath: 'web/docs/index.html' },
    ],
  }, null, 2),
  'utf8',
);

const webResult = smokeReleaseAssets({
  family: 'web',
  releaseAssetsDir,
});
assert.equal(webResult.family, 'web');
assert.ok(fs.existsSync(webResult.archivePath));
assert.ok(fs.existsSync(webResult.smokeReportPath));

assert.throws(
  () =>
    smokeReleaseAssets({
      family: 'unknown',
      releaseAssetsDir,
    }),
  /Unsupported release family: unknown/,
);

fs.rmSync(releaseAssetsDir, { recursive: true, force: true });

console.log('smoke release assets contract passed.');
