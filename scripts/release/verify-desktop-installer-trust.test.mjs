import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DESKTOP_INSTALLER_TRUST_REPORT_FILENAME,
  parseArgs,
  verifyDesktopInstallerArtifactSignature,
  verifyDesktopInstallerTrust,
} from './verify-desktop-installer-trust.mjs';

const currentFilePath = fileURLToPath(import.meta.url);
const verifierSource = fs.readFileSync(
  path.join(path.dirname(currentFilePath), 'verify-desktop-installer-trust.mjs'),
  'utf8',
);

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

const passedWindowsSignatureEvidence = {
  status: 'passed',
  required: true,
  scheme: 'windows-authenticode',
  verifiedAt: '2026-04-08T12:30:00.000Z',
  subject: 'CN=SDKWork BirdCoder',
  issuer: 'CN=SDKWork Code Signing CA',
  timestamped: true,
  notarized: false,
  stapled: false,
  packageMetadataVerified: true,
};

const incompletePassedWindowsSignatureEvidence = {
  ...passedWindowsSignatureEvidence,
  timestamped: false,
};

function writeDesktopTrustFixture({
  releaseAssetsDir,
  manifestArtifacts = null,
} = {}) {
  const familyDir = path.join(releaseAssetsDir, 'desktop', 'windows', 'x64');
  fs.mkdirSync(path.join(familyDir, 'installers', 'nsis'), { recursive: true });
  fs.mkdirSync(path.join(familyDir, 'installers', 'msi'), { recursive: true });
  fs.writeFileSync(path.join(familyDir, 'installers', 'nsis', 'SDKWork BirdCoder_0.1.0_x64-setup.exe'), 'exe');
  fs.writeFileSync(path.join(familyDir, 'installers', 'msi', 'SDKWork BirdCoder_0.1.0_x64_en-US.msi'), 'msi');

  const artifacts = manifestArtifacts ?? [
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
  ];
  const manifestPath = path.join(familyDir, 'release-asset-manifest.json');
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify({
      family: 'desktop',
      profileId: 'sdkwork-birdcoder',
      platform: 'windows',
      arch: 'x64',
      target: 'x86_64-pc-windows-msvc',
      archiveRelativePath: 'desktop/windows/x64/desktop.tar.gz',
      artifacts,
    }, null, 2)}\n`,
  );

  return {
    familyDir,
    manifestPath,
  };
}

assert.throws(
  () => parseArgs(['--release-assets-dir']),
  /Missing value for --release-assets-dir/,
);
assert.deepEqual(
  parseArgs([
    '--release-assets-dir',
    'artifacts/release',
    '--platform',
    'windows',
    '--arch',
    'x64',
    '--target',
    'x86_64-pc-windows-msvc',
    '--release-kind',
    'canary',
    '--rollout-stage',
    'ring-1',
  ]),
  {
    releaseAssetsDir: path.resolve('artifacts/release'),
    platform: 'windows',
    arch: 'x64',
    target: 'x86_64-pc-windows-msvc',
    releaseKind: 'canary',
    rolloutStage: 'ring-1',
  },
);

assert.match(
  verifierSource,
  /'xcrun',\s*\[\s*'stapler',\s*'validate',\s*artifactPath\s*\]/,
  'macOS desktop installer trust verification must explicitly validate the stapled notarization ticket with xcrun stapler validate before promoting evidence to passed',
);

{
  const commandCalls = [];
  const result = verifyDesktopInstallerArtifactSignature({
    artifact: {
      platform: 'macos',
      bundle: 'dmg',
      relativePath: 'desktop/macos/arm64/installers/dmg/BirdCoder.dmg',
    },
    artifactPath: '/tmp/BirdCoder.dmg',
    expectedScheme: 'macos-codesign-notarization',
    verifiedAt: '2026-04-08T12:30:00.000Z',
    commandRunner(command, args) {
      commandCalls.push([command, ...args]);
      if (command === 'codesign' && args.includes('--display')) {
        return {
          stdout: '',
          stderr: [
            'Executable=/tmp/BirdCoder.dmg',
            'Authority=Developer ID Application: SDKWork BirdCoder',
            'Authority=Developer ID Certification Authority',
          ].join('\n'),
        };
      }

      return {
        stdout: '',
        stderr: '',
      };
    },
  });

  assert.equal(result.scheme, 'macos-codesign-notarization');
  assert.equal(result.subject, 'Developer ID Application: SDKWork BirdCoder');
  assert.equal(result.issuer, 'Developer ID Certification Authority');
  assert.equal(result.notarized, true);
  assert.equal(result.stapled, true);
  assert.deepEqual(
    commandCalls.filter((call) => call[0] === 'xcrun'),
    [['xcrun', 'stapler', 'validate', '/tmp/BirdCoder.dmg']],
  );
}

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-desktop-trust-'));
try {
  const { familyDir, manifestPath } = writeDesktopTrustFixture({ releaseAssetsDir });
  const verifierCalls = [];
  const result = verifyDesktopInstallerTrust({
    releaseAssetsDir,
    platform: 'windows',
    arch: 'x64',
    target: 'x86_64-pc-windows-msvc',
    verifiedAt: '2026-04-08T12:30:00.000Z',
    verifierFn({ artifact, artifactPath, expectedScheme }) {
      verifierCalls.push({
        relativePath: artifact.relativePath,
        artifactPath: path.relative(releaseAssetsDir, artifactPath).replaceAll('\\', '/'),
        expectedScheme,
      });
      return passedWindowsSignatureEvidence;
    },
  });

  assert.equal(result.status, 'passed');
  assert.equal(result.installerCount, 2);
  assert.equal(result.reportPath, path.join(familyDir, DESKTOP_INSTALLER_TRUST_REPORT_FILENAME));
  assert.deepEqual(
    verifierCalls.map((call) => ({
      relativePath: call.relativePath,
      artifactPath: call.artifactPath,
      expectedScheme: call.expectedScheme,
    })),
    [
      {
        relativePath: 'desktop/windows/x64/installers/msi/SDKWork BirdCoder_0.1.0_x64_en-US.msi',
        artifactPath: 'desktop/windows/x64/installers/msi/SDKWork BirdCoder_0.1.0_x64_en-US.msi',
        expectedScheme: 'windows-authenticode',
      },
      {
        relativePath: 'desktop/windows/x64/installers/nsis/SDKWork BirdCoder_0.1.0_x64-setup.exe',
        artifactPath: 'desktop/windows/x64/installers/nsis/SDKWork BirdCoder_0.1.0_x64-setup.exe',
        expectedScheme: 'windows-authenticode',
      },
    ],
  );

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.deepEqual(
    manifest.artifacts
      .filter((artifact) => artifact.kind === 'installer')
      .map((artifact) => artifact.signatureEvidence),
    [passedWindowsSignatureEvidence, passedWindowsSignatureEvidence],
  );

  const report = JSON.parse(fs.readFileSync(result.reportPath, 'utf8'));
  assert.equal(report.status, 'passed');
  assert.equal(report.installerCount, 2);
  assert.deepEqual(
    report.installers.map((entry) => ({
      relativePath: entry.relativePath,
      bundle: entry.bundle,
      signatureEvidence: entry.signatureEvidence,
    })),
    [
      {
        relativePath: 'desktop/windows/x64/installers/msi/SDKWork BirdCoder_0.1.0_x64_en-US.msi',
        bundle: 'msi',
        signatureEvidence: passedWindowsSignatureEvidence,
      },
      {
        relativePath: 'desktop/windows/x64/installers/nsis/SDKWork BirdCoder_0.1.0_x64-setup.exe',
        bundle: 'nsis',
        signatureEvidence: passedWindowsSignatureEvidence,
      },
    ],
  );
} finally {
  fs.rmSync(releaseAssetsDir, { recursive: true, force: true });
}

const failedReleaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-desktop-trust-failed-'));
try {
  const { familyDir, manifestPath } = writeDesktopTrustFixture({ releaseAssetsDir: failedReleaseAssetsDir });
  const originalManifest = fs.readFileSync(manifestPath, 'utf8');

  assert.throws(
    () => verifyDesktopInstallerTrust({
      releaseAssetsDir: failedReleaseAssetsDir,
      platform: 'windows',
      arch: 'x64',
      target: 'x86_64-pc-windows-msvc',
      verifierFn({ artifact }) {
        if (artifact.bundle === 'msi') {
          throw new Error('Authenticode signature is not valid.');
        }

        return passedWindowsSignatureEvidence;
      },
    }),
    /Authenticode signature is not valid/,
  );
  assert.equal(fs.readFileSync(manifestPath, 'utf8'), originalManifest);
  assert.equal(
    fs.existsSync(path.join(familyDir, DESKTOP_INSTALLER_TRUST_REPORT_FILENAME)),
    false,
    'trust verifier must not write a success report after any installer verification fails',
  );
} finally {
  fs.rmSync(failedReleaseAssetsDir, { recursive: true, force: true });
}

const pendingReleaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-desktop-trust-pending-'));
try {
  const { familyDir, manifestPath } = writeDesktopTrustFixture({ releaseAssetsDir: pendingReleaseAssetsDir });
  const originalManifest = fs.readFileSync(manifestPath, 'utf8');
  const result = verifyDesktopInstallerTrust({
    releaseAssetsDir: pendingReleaseAssetsDir,
    platform: 'windows',
    arch: 'x64',
    target: 'x86_64-pc-windows-msvc',
    releaseKind: 'canary',
    rolloutStage: 'ring-1',
    verifierFn() {
      throw new Error('Authenticode toolchain unavailable.');
    },
  });

  assert.equal(result.status, 'pending');
  assert.equal(result.reportPath, path.join(familyDir, DESKTOP_INSTALLER_TRUST_REPORT_FILENAME));
  assert.equal(fs.readFileSync(manifestPath, 'utf8'), originalManifest);

  const report = JSON.parse(fs.readFileSync(result.reportPath, 'utf8'));
  assert.equal(report.status, 'pending');
  assert.equal(report.installerCount, 2);
  assert.equal(report.releaseKind, 'canary');
  assert.equal(report.rolloutStage, 'ring-1');
  assert.deepEqual(
    report.installers.map((entry) => entry.signatureEvidence),
    [pendingWindowsSignatureEvidence, pendingWindowsSignatureEvidence],
  );
  assert.ok(
    report.pendingReasons.every((reason) => reason.includes('Authenticode toolchain unavailable')),
    'pending trust report must preserve verifier failure reasons for canary evidence review',
  );
} finally {
  fs.rmSync(pendingReleaseAssetsDir, { recursive: true, force: true });
}

const incompleteEvidenceReleaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-desktop-trust-incomplete-'));
try {
  const { familyDir, manifestPath } = writeDesktopTrustFixture({ releaseAssetsDir: incompleteEvidenceReleaseAssetsDir });
  const originalManifest = fs.readFileSync(manifestPath, 'utf8');

  assert.throws(
    () => verifyDesktopInstallerTrust({
      releaseAssetsDir: incompleteEvidenceReleaseAssetsDir,
      platform: 'windows',
      arch: 'x64',
      target: 'x86_64-pc-windows-msvc',
      verifierFn() {
        return incompletePassedWindowsSignatureEvidence;
      },
    }),
    /desktop installer trust evidence `desktop\/windows\/x64\/installers\/msi\/SDKWork BirdCoder_0\.1\.0_x64_en-US\.msi` is not timestamped/,
  );
  assert.equal(fs.readFileSync(manifestPath, 'utf8'), originalManifest);
  assert.equal(
    fs.existsSync(path.join(familyDir, DESKTOP_INSTALLER_TRUST_REPORT_FILENAME)),
    false,
    'trust verifier must not write a success report after incomplete passed evidence',
  );
} finally {
  fs.rmSync(incompleteEvidenceReleaseAssetsDir, { recursive: true, force: true });
}

console.log('desktop installer trust verifier contract passed.');
