import assert from 'node:assert/strict';

import {
  assertClearStopShipEvidence,
  collectReleaseStopShipSignals,
} from './release-stop-ship-governance.mjs';

const clearQualityEvidence = {
  archiveRelativePath: 'quality/quality-gate-matrix-report.json',
  totalTiers: 1,
  workflowBoundTiers: 1,
  missingWorkflowBindings: [],
  manifestBoundTiers: 1,
  missingManifestBindings: [],
  tierIds: ['release'],
  failureClassificationIds: [],
  environmentDiagnostics: 0,
  blockingDiagnosticIds: [],
  blockingDiagnostics: [],
  releaseGovernanceCheckIds: [],
  executionBlockingTierIds: [],
  executionFailedTierIds: [],
  executionSkippedTierIds: [],
  executionBlockingDiagnosticIds: [],
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

const readyDesktopAssets = [
  {
    family: 'desktop',
    platform: 'windows',
    arch: 'x64',
    artifacts: [
      {
        relativePath: 'desktop/windows/x64/desktop-setup.exe',
        kind: 'installer',
        bundle: 'nsis',
        installerFormat: 'nsis',
        target: 'x86_64-pc-windows-msvc',
        signatureEvidence: passedWindowsSignatureEvidence,
      },
    ],
    desktopInstallerTrust: {
      reportRelativePath: 'desktop/windows/x64/desktop-installer-trust-report.json',
      manifestRelativePath: 'desktop/windows/x64/release-asset-manifest.json',
      status: 'passed',
      platform: 'windows',
      arch: 'x64',
      target: 'x86_64-pc-windows-msvc',
      verifiedAt: '2026-04-08T12:30:00.000Z',
      installerCount: 1,
      installers: [
        {
          relativePath: 'desktop/windows/x64/desktop-setup.exe',
          bundle: 'nsis',
          installerFormat: 'nsis',
          target: 'x86_64-pc-windows-msvc',
          signatureEvidence: passedWindowsSignatureEvidence,
        },
      ],
    },
    desktopStartupReadinessSummary: {
      ready: true,
      shellMounted: true,
      workspaceBootstrapReady: true,
      localProjectRecoveryReady: true,
      workspaceBootstrapChecks: [
        'defaultWorkspaceReady',
        'defaultProjectReady',
        'recoverySnapshotReady',
      ],
      localProjectRecoveryChecks: [
        'autoRemountSupported',
        'recoveringStateVisible',
        'failedStateVisible',
        'retrySupported',
        'reimportSupported',
      ],
    },
  },
];

assert.deepEqual(collectReleaseStopShipSignals({
  qualityEvidence: clearQualityEvidence,
  assets: readyDesktopAssets,
}), []);

const missingInstallerTrustReportAssets = [
  {
    ...readyDesktopAssets[0],
    desktopInstallerTrust: undefined,
  },
];

assert.deepEqual(collectReleaseStopShipSignals({
  qualityEvidence: clearQualityEvidence,
  assets: missingInstallerTrustReportAssets,
}), [
  'desktop installer trust report `windows/x64` is missing',
]);

const recoveryGapAssets = [
  {
    family: 'desktop',
    platform: 'windows',
    arch: 'x64',
    desktopStartupReadinessSummary: {
      ready: false,
      shellMounted: true,
      workspaceBootstrapReady: true,
      localProjectRecoveryReady: false,
      workspaceBootstrapChecks: [
        'defaultWorkspaceReady',
        'defaultProjectReady',
        'recoverySnapshotReady',
      ],
      localProjectRecoveryChecks: [
        'autoRemountSupported',
        'recoveringStateVisible',
        'failedStateVisible',
      ],
    },
  },
];

assert.deepEqual(collectReleaseStopShipSignals({
  qualityEvidence: clearQualityEvidence,
  assets: recoveryGapAssets,
}), [
  'desktop local project recovery `windows/x64` is `not-ready`',
]);

assert.throws(
  () => assertClearStopShipEvidence({
    releaseControl: {
    releaseKind: 'formal',
    rolloutStage: 'general-availability',
  },
  qualityEvidence: clearQualityEvidence,
  assets: recoveryGapAssets,
  errorPrefix: 'formal gating requires clear stop-ship evidence',
}),
  /formal gating requires clear stop-ship evidence: desktop local project recovery `windows\/x64` is `not-ready`/,
);

const missingSummaryAssets = [
  {
    family: 'desktop',
    platform: 'windows',
    arch: 'x64',
  },
];

assert.deepEqual(collectReleaseStopShipSignals({
  qualityEvidence: clearQualityEvidence,
  assets: missingSummaryAssets,
}), [
  'desktop startup readiness summary missing `windows/x64`',
]);

const pendingInstallerTrustAssets = [
  {
    family: 'desktop',
    platform: 'windows',
    arch: 'x64',
    artifacts: [
      {
        relativePath: 'desktop/windows/x64/desktop-setup.exe',
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
    desktopStartupReadinessSummary: readyDesktopAssets[0].desktopStartupReadinessSummary,
  },
];

assert.deepEqual(collectReleaseStopShipSignals({
  qualityEvidence: clearQualityEvidence,
  assets: pendingInstallerTrustAssets,
}), [
  'desktop installer trust report `windows/x64` is missing',
  'desktop installer trust evidence `desktop/windows/x64/desktop-setup.exe` is `pending`',
]);

assert.throws(
  () => assertClearStopShipEvidence({
    releaseControl: {
      releaseKind: 'formal',
      rolloutStage: 'general-availability',
    },
    qualityEvidence: clearQualityEvidence,
    assets: pendingInstallerTrustAssets,
    errorPrefix: 'formal gating requires clear stop-ship evidence',
  }),
  /formal gating requires clear stop-ship evidence: desktop installer trust report `windows\/x64` is missing; desktop installer trust evidence `desktop\/windows\/x64\/desktop-setup\.exe` is `pending`/,
);

console.log('release stop-ship governance contract passed.');
