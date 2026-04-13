import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { smokeDesktopPackagedLaunch } from './smoke-desktop-packaged-launch.mjs';

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-desktop-packaged-launch-'));
const familyDir = path.join(releaseAssetsDir, 'desktop', 'windows', 'x64');
fs.mkdirSync(familyDir, { recursive: true });
fs.writeFileSync(path.join(familyDir, 'sdkwork-birdcoder-desktop-release-local-windows-x64.tar.gz'), 'tar');
fs.writeFileSync(
  path.join(familyDir, 'release-asset-manifest.json'),
  JSON.stringify({
    family: 'desktop',
    platform: 'windows',
    arch: 'x64',
    archiveRelativePath: 'desktop/windows/x64/sdkwork-birdcoder-desktop-release-local-windows-x64.tar.gz',
    artifacts: [
      {
        relativePath: 'desktop/windows/x64/sdkwork-birdcoder-desktop-release-local-windows-x64.tar.gz',
        size: 3,
      },
    ],
  }, null, 2),
);

const result = smokeDesktopPackagedLaunch({
  releaseAssetsDir,
  platform: 'windows',
  arch: 'x64',
  target: 'x86_64-pc-windows-msvc',
});

assert.equal(result.smokeKind, 'packaged-launch-contract');
assert.ok(fs.existsSync(result.archivePath));
assert.ok(fs.existsSync(result.smokeReportPath));

fs.rmSync(releaseAssetsDir, { recursive: true, force: true });
console.log('desktop packaged launch smoke contract passed.');
