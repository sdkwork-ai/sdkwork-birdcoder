import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { smokeDesktopInstallers } from './smoke-desktop-installers.mjs';

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-desktop-smoke-'));
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
      },
      {
        relativePath: 'desktop/windows/x64/installers/nsis/SDKWork BirdCoder_0.1.0_x64-setup.exe',
        kind: 'installer',
        bundle: 'nsis',
        installerFormat: 'nsis',
        target: 'x86_64-pc-windows-msvc',
        signatureEvidence: {
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
        },
      },
      {
        relativePath: 'desktop/windows/x64/installers/msi/SDKWork BirdCoder_0.1.0_x64_en-US.msi',
        kind: 'installer',
        bundle: 'msi',
        installerFormat: 'msi',
        target: 'x86_64-pc-windows-msvc',
        signatureEvidence: {
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
        },
      },
    ],
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
const smokeReport = JSON.parse(fs.readFileSync(result.smokeReportPath, 'utf8'));
assert.deepEqual(smokeReport.installableArtifactRelativePaths, [
  'desktop/windows/x64/installers/msi/SDKWork BirdCoder_0.1.0_x64_en-US.msi',
  'desktop/windows/x64/installers/nsis/SDKWork BirdCoder_0.1.0_x64-setup.exe',
]);
assert.deepEqual(
  smokeReport.installPlanSummaries.map((entry) => entry.format),
  ['msi', 'nsis'],
);
assert.deepEqual(
  smokeReport.installPlanSummaries.map((entry) => ({
    relativePath: entry.relativePath,
    format: entry.format,
    bundle: entry.bundle,
    target: entry.target,
    signatureEvidence: entry.signatureEvidence,
  })),
  [
    {
      relativePath: 'desktop/windows/x64/installers/msi/SDKWork BirdCoder_0.1.0_x64_en-US.msi',
      format: 'msi',
      bundle: 'msi',
      target: 'x86_64-pc-windows-msvc',
      signatureEvidence: {
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
      },
    },
    {
      relativePath: 'desktop/windows/x64/installers/nsis/SDKWork BirdCoder_0.1.0_x64-setup.exe',
      format: 'nsis',
      bundle: 'nsis',
      target: 'x86_64-pc-windows-msvc',
      signatureEvidence: {
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
      },
    },
  ],
);

fs.rmSync(releaseAssetsDir, { recursive: true, force: true });

const missingInstallerReleaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-desktop-smoke-missing-'));
const missingInstallerFamilyDir = path.join(missingInstallerReleaseAssetsDir, 'desktop', 'windows', 'x64');
fs.mkdirSync(missingInstallerFamilyDir, { recursive: true });
fs.writeFileSync(
  path.join(missingInstallerFamilyDir, 'sdkwork-birdcoder-desktop-release-local-windows-x64.tar.gz'),
  'tar',
);
fs.writeFileSync(
  path.join(missingInstallerFamilyDir, 'release-asset-manifest.json'),
  JSON.stringify({
    family: 'desktop',
    platform: 'windows',
    arch: 'x64',
    archiveRelativePath: 'desktop/windows/x64/sdkwork-birdcoder-desktop-release-local-windows-x64.tar.gz',
    artifacts: [
      {
        relativePath: 'desktop/windows/x64/sdkwork-birdcoder-desktop-release-local-windows-x64.tar.gz',
      },
      {
        relativePath: 'desktop/windows/x64/installers/nsis/SDKWork BirdCoder_0.1.0_x64-setup.exe',
        kind: 'installer',
        bundle: 'nsis',
        installerFormat: 'nsis',
        target: 'x86_64-pc-windows-msvc',
        signatureEvidence: {
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
        },
      },
    ],
  }, null, 2),
);
assert.throws(
  () => smokeDesktopInstallers({
    releaseAssetsDir: missingInstallerReleaseAssetsDir,
    platform: 'windows',
    arch: 'x64',
    target: 'x86_64-pc-windows-msvc',
  }),
  /Missing native desktop installer artifact referenced by .*release-asset-manifest\.json/u,
  'desktop installer smoke must fail when the manifest references a native installer artifact that is not present on disk',
);
fs.rmSync(missingInstallerReleaseAssetsDir, { recursive: true, force: true });

const missingMetadataReleaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-desktop-smoke-metadata-'));
const missingMetadataFamilyDir = path.join(missingMetadataReleaseAssetsDir, 'desktop', 'windows', 'x64');
fs.mkdirSync(path.join(missingMetadataFamilyDir, 'installers', 'nsis'), { recursive: true });
fs.writeFileSync(
  path.join(missingMetadataFamilyDir, 'sdkwork-birdcoder-desktop-release-local-windows-x64.tar.gz'),
  'tar',
);
fs.writeFileSync(
  path.join(missingMetadataFamilyDir, 'installers', 'nsis', 'SDKWork BirdCoder_0.1.0_x64-setup.exe'),
  'exe',
);
fs.writeFileSync(
  path.join(missingMetadataFamilyDir, 'release-asset-manifest.json'),
  JSON.stringify({
    family: 'desktop',
    platform: 'windows',
    arch: 'x64',
    archiveRelativePath: 'desktop/windows/x64/sdkwork-birdcoder-desktop-release-local-windows-x64.tar.gz',
    artifacts: [
      {
        relativePath: 'desktop/windows/x64/sdkwork-birdcoder-desktop-release-local-windows-x64.tar.gz',
      },
      {
        relativePath: 'desktop/windows/x64/installers/nsis/SDKWork BirdCoder_0.1.0_x64-setup.exe',
      },
    ],
  }, null, 2),
);
assert.throws(
  () => smokeDesktopInstallers({
    releaseAssetsDir: missingMetadataReleaseAssetsDir,
    platform: 'windows',
    arch: 'x64',
    target: 'x86_64-pc-windows-msvc',
  }),
  /Desktop installer manifest artifact must declare kind=installer, bundle, installerFormat, and target/u,
  'desktop installer smoke must reject installer artifacts that require path inference instead of explicit manifest metadata',
);
fs.rmSync(missingMetadataReleaseAssetsDir, { recursive: true, force: true });

const missingSignatureEvidenceReleaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-desktop-smoke-signature-'));
const missingSignatureEvidenceFamilyDir = path.join(missingSignatureEvidenceReleaseAssetsDir, 'desktop', 'windows', 'x64');
fs.mkdirSync(path.join(missingSignatureEvidenceFamilyDir, 'installers', 'nsis'), { recursive: true });
fs.writeFileSync(
  path.join(missingSignatureEvidenceFamilyDir, 'sdkwork-birdcoder-desktop-release-local-windows-x64.tar.gz'),
  'tar',
);
fs.writeFileSync(
  path.join(missingSignatureEvidenceFamilyDir, 'installers', 'nsis', 'SDKWork BirdCoder_0.1.0_x64-setup.exe'),
  'exe',
);
fs.writeFileSync(
  path.join(missingSignatureEvidenceFamilyDir, 'release-asset-manifest.json'),
  JSON.stringify({
    family: 'desktop',
    platform: 'windows',
    arch: 'x64',
    archiveRelativePath: 'desktop/windows/x64/sdkwork-birdcoder-desktop-release-local-windows-x64.tar.gz',
    artifacts: [
      {
        relativePath: 'desktop/windows/x64/sdkwork-birdcoder-desktop-release-local-windows-x64.tar.gz',
      },
      {
        relativePath: 'desktop/windows/x64/installers/nsis/SDKWork BirdCoder_0.1.0_x64-setup.exe',
        kind: 'installer',
        bundle: 'nsis',
        installerFormat: 'nsis',
        target: 'x86_64-pc-windows-msvc',
      },
    ],
  }, null, 2),
);
assert.throws(
  () => smokeDesktopInstallers({
    releaseAssetsDir: missingSignatureEvidenceReleaseAssetsDir,
    platform: 'windows',
    arch: 'x64',
    target: 'x86_64-pc-windows-msvc',
  }),
  /Desktop installer manifest artifact must declare signatureEvidence/u,
  'desktop installer smoke must reject installer artifacts that omit machine-readable trust evidence',
);
fs.rmSync(missingSignatureEvidenceReleaseAssetsDir, { recursive: true, force: true });

console.log('desktop installer smoke contract passed.');
