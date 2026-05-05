import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { smokeDesktopPackagedLaunch } from './smoke-desktop-packaged-launch.mjs';

const pendingWindowsSignatureEvidence = {
  status: 'pending',
  required: true,
  scheme: 'windows-authenticode',
  verifiedAt: '',
  subject: '',
  issuer: '',
  timestamped: false,
  notarized: false,
  stapled: false,
  packageMetadataVerified: false,
};

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-desktop-packaged-launch-'));
const familyDir = path.join(releaseAssetsDir, 'desktop', 'windows', 'x64');
fs.mkdirSync(familyDir, { recursive: true });
fs.writeFileSync(path.join(familyDir, 'sdkwork-birdcoder-desktop-release-local-windows-x64.tar.gz'), 'tar');
fs.mkdirSync(path.join(familyDir, 'installers', 'nsis'), { recursive: true });
fs.mkdirSync(path.join(familyDir, 'installers', 'msi'), { recursive: true });
fs.writeFileSync(path.join(familyDir, 'installers', 'nsis', 'SDKWork BirdCoder_0.1.0_x64-setup.exe'), 'exe');
fs.writeFileSync(path.join(familyDir, 'installers', 'msi', 'SDKWork BirdCoder_0.1.0_x64_en-US.msi'), 'msi');
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
      {
        relativePath: 'desktop/windows/x64/installers/nsis/SDKWork BirdCoder_0.1.0_x64-setup.exe',
        size: 3,
        kind: 'installer',
        bundle: 'nsis',
        installerFormat: 'nsis',
        target: 'x86_64-pc-windows-msvc',
        signatureEvidence: pendingWindowsSignatureEvidence,
      },
      {
        relativePath: 'desktop/windows/x64/installers/msi/SDKWork BirdCoder_0.1.0_x64_en-US.msi',
        size: 3,
        kind: 'installer',
        bundle: 'msi',
        installerFormat: 'msi',
        target: 'x86_64-pc-windows-msvc',
        signatureEvidence: pendingWindowsSignatureEvidence,
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
