import assert from 'node:assert/strict';

import {
  normalizeQualityEvidenceSummary,
  summarizeQualityLoopScoreboard,
} from './release/quality-gate-release-evidence.mjs';

const blockedScoreboard = summarizeQualityLoopScoreboard({
  totalTiers: 3,
  workflowBoundTiers: 3,
  tierIds: ['fast', 'standard', 'release'],
  releaseGovernanceCheckIds: [
    'engine-runtime-adapter',
    'engine-conformance',
    'tool-protocol',
    'engine-resume-recovery',
  ],
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
  tierIds: ['fast', 'standard', 'release'],
  releaseGovernanceCheckIds: [
    'engine-runtime-adapter',
    'engine-conformance',
    'tool-protocol',
    'engine-resume-recovery',
  ],
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
  next_focus: 'Close workflow-binding or contract-drift gaps before adding new delivery slices.',
});

const normalizedQualitySummary = normalizeQualityEvidenceSummary({
  archiveRelativePath: 'quality/quality-gate-matrix-report.json',
  totalTiers: 3,
  workflowBoundTiers: 3,
  tierIds: ['fast', 'standard', 'release'],
  failureClassificationIds: ['contract-drift', 'toolchain-platform', 'artifact-integrity', 'evidence-gap'],
  environmentDiagnostics: 1,
  blockingDiagnosticIds: ['vite-host-build-preflight'],
  releaseGovernanceCheckIds: [
    'engine-runtime-adapter',
    'engine-conformance',
    'tool-protocol',
    'engine-resume-recovery',
  ],
  executionStatus: 'blocked',
  executionBlockingTierIds: ['standard'],
  executionFailedTierIds: [],
  executionSkippedTierIds: ['release'],
  executionBlockingDiagnosticIds: ['vite-host-build-preflight'],
});

assert.deepEqual(normalizedQualitySummary.loopScoreboard, blockedScoreboard);

console.log('quality loop scoreboard contract passed.');
