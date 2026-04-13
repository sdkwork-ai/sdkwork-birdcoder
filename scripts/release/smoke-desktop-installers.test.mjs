import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { smokeDesktopInstallers } from './smoke-desktop-installers.mjs';

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-desktop-smoke-'));
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
  }, null, 2),
);

const result = smokeDesktopInstallers({
  releaseAssetsDir,
  platform: 'windows',
  arch: 'x64',
  target: 'x86_64-pc-windows-msvc',
});
assert.equal(result.family, 'desktop');
assert.ok(fs.existsSync(result.archivePath));
assert.ok(fs.existsSync(result.smokeReportPath));

fs.rmSync(releaseAssetsDir, { recursive: true, force: true });
console.log('desktop installer smoke contract passed.');
