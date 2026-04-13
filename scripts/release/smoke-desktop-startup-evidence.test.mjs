import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { smokeDesktopStartupEvidence } from './smoke-desktop-startup-evidence.mjs';

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-desktop-startup-smoke-'));
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

const result = smokeDesktopStartupEvidence({
  releaseAssetsDir,
  platform: 'windows',
  arch: 'x64',
  target: 'x86_64-pc-windows-msvc',
});

assert.equal(result.smokeKind, 'startup-evidence-contract');
assert.ok(fs.existsSync(result.capturedEvidencePath));
assert.ok(fs.existsSync(result.smokeReportPath));

fs.rmSync(releaseAssetsDir, { recursive: true, force: true });
console.log('desktop startup smoke contract passed.');
