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

const readyDesktopAssets = [
  {
    family: 'desktop',
    platform: 'windows',
    arch: 'x64',
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

console.log('release stop-ship governance contract passed.');
