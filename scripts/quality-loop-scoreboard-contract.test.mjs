import assert from 'node:assert/strict';

import { ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS } from './governance-regression-report.mjs';
import {
  normalizeQualityEvidenceSummary,
  summarizeQualityLoopScoreboard,
} from './release/quality-gate-release-evidence.mjs';

const legacyReleaseGovernanceCheckIds = ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS.slice(0, 4);

const blockedScoreboard = summarizeQualityLoopScoreboard({
  totalTiers: 3,
  workflowBoundTiers: 3,
  manifestBoundTiers: 3,
  tierIds: ['fast', 'standard', 'release'],
  releaseGovernanceCheckIds: ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS,
  blockingDiagnosticIds: ['vite-host-build-preflight'],
  executionStatus: 'blocked',
  executionBlockingTierIds: ['standard'],
  executionFailedTierIds: [],
  executionSkippedTierIds: ['release'],
});

assert.deepEqual(blockedScoreboard, {
  architecture_alignment: 100,
  implementation_completeness: 100,
  test_closure: 70,
  commercial_readiness: 60,
  lowest_score_item: 'commercial_readiness',
  next_focus: 'Clear blocking diagnostics (`vite-host-build-preflight`) and rerun quality gates.',
});

const clearScoreboard = summarizeQualityLoopScoreboard({
  totalTiers: 3,
  workflowBoundTiers: 3,
  manifestBoundTiers: 3,
  tierIds: ['fast', 'standard', 'release'],
  releaseGovernanceCheckIds: ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS,
  blockingDiagnosticIds: [],
  executionStatus: 'passed',
  executionBlockingTierIds: [],
  executionFailedTierIds: [],
  executionSkippedTierIds: [],
});

assert.deepEqual(clearScoreboard, {
  architecture_alignment: 100,
  implementation_completeness: 100,
  test_closure: 100,
  commercial_readiness: 100,
  lowest_score_item: 'architecture_alignment',
  next_focus: 'Close workflow or manifest binding gaps before adding new delivery slices.',
});

const releaseReadinessBlockedScoreboard = summarizeQualityLoopScoreboard({
  totalTiers: 3,
  workflowBoundTiers: 3,
  manifestBoundTiers: 3,
  tierIds: ['fast', 'standard', 'release'],
  releaseGovernanceCheckIds: ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS,
  blockingDiagnosticIds: [],
  executionStatus: 'passed',
  executionBlockingTierIds: [],
  executionFailedTierIds: [],
  executionSkippedTierIds: [],
  releaseReadinessSignals: ['desktop local project recovery `windows/x64` is `not-ready`'],
});

assert.deepEqual(releaseReadinessBlockedScoreboard, {
  architecture_alignment: 100,
  implementation_completeness: 100,
  test_closure: 100,
  commercial_readiness: 80,
  lowest_score_item: 'commercial_readiness',
  next_focus: 'Clear release-readiness blockers (desktop local project recovery `windows/x64` is `not-ready`) and rerun finalize smoke.',
});

const normalizedQualitySummary = normalizeQualityEvidenceSummary({
  archiveRelativePath: 'quality/quality-gate-matrix-report.json',
  totalTiers: 3,
  workflowBoundTiers: 3,
  manifestBoundTiers: 3,
  tierIds: ['fast', 'standard', 'release'],
  failureClassificationIds: ['contract-drift', 'toolchain-platform', 'artifact-integrity', 'evidence-gap'],
  environmentDiagnostics: 1,
  blockingDiagnosticIds: ['vite-host-build-preflight'],
  releaseGovernanceCheckIds: ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS,
  executionStatus: 'blocked',
  executionBlockingTierIds: ['standard'],
  executionFailedTierIds: [],
  executionSkippedTierIds: ['release'],
  executionBlockingDiagnosticIds: ['vite-host-build-preflight'],
});

assert.deepEqual(normalizedQualitySummary.loopScoreboard, blockedScoreboard);

const normalizedReleaseReadinessSummary = normalizeQualityEvidenceSummary({
  archiveRelativePath: 'quality/quality-gate-matrix-report.json',
  totalTiers: 3,
  workflowBoundTiers: 3,
  manifestBoundTiers: 3,
  tierIds: ['fast', 'standard', 'release'],
  failureClassificationIds: ['contract-drift'],
  environmentDiagnostics: 0,
  blockingDiagnosticIds: [],
  releaseGovernanceCheckIds: ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS,
  executionStatus: 'passed',
  executionBlockingTierIds: [],
  executionFailedTierIds: [],
  executionSkippedTierIds: [],
  releaseReadinessSignals: ['desktop local project recovery `windows/x64` is `not-ready`'],
});

assert.deepEqual(
  normalizedReleaseReadinessSummary.releaseReadinessSignals,
  ['desktop local project recovery `windows/x64` is `not-ready`'],
);
assert.deepEqual(
  normalizedReleaseReadinessSummary.loopScoreboard,
  releaseReadinessBlockedScoreboard,
);

const legacyScoreboard = summarizeQualityLoopScoreboard({
  totalTiers: 3,
  workflowBoundTiers: 3,
  manifestBoundTiers: 3,
  tierIds: ['fast', 'standard', 'release'],
  releaseGovernanceCheckIds: legacyReleaseGovernanceCheckIds,
  blockingDiagnosticIds: [],
  executionStatus: 'passed',
  executionBlockingTierIds: [],
  executionFailedTierIds: [],
  executionSkippedTierIds: [],
});

assert.equal(
  legacyScoreboard.implementation_completeness,
  Math.round(
    (
      (1 * 0.6)
      + ((legacyReleaseGovernanceCheckIds.length / ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS.length) * 0.4)
    ) * 100,
  ),
);
assert.ok(
  legacyScoreboard.implementation_completeness < clearScoreboard.implementation_completeness,
);

console.log('quality loop scoreboard contract passed.');
