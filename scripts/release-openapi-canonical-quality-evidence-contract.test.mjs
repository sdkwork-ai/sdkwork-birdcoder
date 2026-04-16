import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { buildQualityGateMatrixReport } from './quality-gate-matrix-report.mjs';
import {
  summarizeQualityGateReleaseEvidence,
} from './release/quality-gate-release-evidence.mjs';
import {
  smokeFinalizedReleaseAssets,
} from './release/smoke-finalized-release-assets.mjs';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeStringList(values) {
  return Array.from(new Set(
    (values ?? [])
      .map((value) => String(value ?? '').trim())
      .filter(Boolean),
  ));
}

function normalizeStableMatrixReport(report = {}) {
  return {
    summary: {
      totalTiers: Number(report.summary?.totalTiers ?? 0),
      workflowBoundTiers: Number(report.summary?.workflowBoundTiers ?? 0),
      missingWorkflowBindings: normalizeStringList(report.summary?.missingWorkflowBindings ?? []),
      manifestBoundTiers: Number(report.summary?.manifestBoundTiers ?? 0),
      missingManifestBindings: normalizeStringList(report.summary?.missingManifestBindings ?? []),
      failureClassifications: Number(report.summary?.failureClassifications ?? 0),
    },
    tiers: (report.tiers ?? []).map((tier) => ({
      id: String(tier?.id ?? '').trim(),
      command: String(tier?.command ?? '').trim(),
      governanceCheckIds: normalizeStringList(tier?.governanceCheckIds ?? []),
      workflow: {
        bound: Boolean(tier?.workflow?.bound),
        requiredCommands: normalizeStringList(tier?.workflow?.requiredCommands ?? []),
      },
      manifest: {
        bound: Boolean(tier?.manifest?.bound),
        scriptName: String(tier?.manifest?.scriptName ?? '').trim(),
      },
    })),
    failureClassifications: (report.failureClassifications ?? []).map((classification) => ({
      id: String(classification?.id ?? '').trim(),
    })),
  };
}

function normalizeStableQualitySummary(summary = {}) {
  return {
    archiveRelativePath: String(summary.archiveRelativePath ?? '').trim().split(path.sep).join('/'),
    totalTiers: Number(summary.totalTiers ?? 0),
    workflowBoundTiers: Number(summary.workflowBoundTiers ?? 0),
    missingWorkflowBindings: normalizeStringList(summary.missingWorkflowBindings ?? []),
    manifestBoundTiers: Number(summary.manifestBoundTiers ?? 0),
    missingManifestBindings: normalizeStringList(summary.missingManifestBindings ?? []),
    tierIds: normalizeStringList(summary.tierIds ?? []),
    failureClassificationIds: normalizeStringList(summary.failureClassificationIds ?? []),
    releaseGovernanceCheckIds: normalizeStringList(summary.releaseGovernanceCheckIds ?? []),
    executionArchiveRelativePath: String(summary.executionArchiveRelativePath ?? '').trim().split(path.sep).join('/'),
    executionStatus: String(summary.executionStatus ?? '').trim(),
    lastExecutedTierId: String(summary.lastExecutedTierId ?? '').trim(),
    executionBlockingTierIds: normalizeStringList(summary.executionBlockingTierIds ?? []),
    executionFailedTierIds: normalizeStringList(summary.executionFailedTierIds ?? []),
    executionSkippedTierIds: normalizeStringList(summary.executionSkippedTierIds ?? []),
    executionBlockingDiagnosticIds: normalizeStringList(summary.executionBlockingDiagnosticIds ?? []),
  };
}

function normalizeStableCodingServerOpenApiEvidence(summary = null) {
  if (!summary) {
    return null;
  }

  return {
    canonicalRelativePath: String(summary.canonicalRelativePath ?? '').trim().split(path.sep).join('/'),
    mirroredRelativePaths: normalizeStringList(summary.mirroredRelativePaths ?? []),
    targetCount: Number(summary.targetCount ?? 0),
    targets: normalizeStringList(summary.targets ?? []),
    sha256: String(summary.sha256 ?? '').trim(),
    openapi: String(summary.openapi ?? '').trim(),
    version: String(summary.version ?? '').trim(),
    title: String(summary.title ?? '').trim(),
  };
}

function normalizeStableOptionalSummary(summary = null) {
  if (!summary) {
    return null;
  }

  const normalized = {};
  for (const [key, value] of Object.entries(summary)) {
    if (Array.isArray(value)) {
      normalized[key] = normalizeStringList(value);
      continue;
    }

    if (value && typeof value === 'object') {
      normalized[key] = normalizeStableOptionalSummary(value);
      continue;
    }

    normalized[key] = value;
  }

  return normalized;
}

function normalizeStableFinalizedSmokeReport(report = {}) {
  return {
    status: String(report.status ?? '').trim(),
    checks: (report.checks ?? []).map((entry) => ({
      id: String(entry?.id ?? '').trim(),
      status: String(entry?.status ?? '').trim(),
      detail: String(entry?.detail ?? '').trim(),
    })),
    stopShipSignals: normalizeStringList(report.stopShipSignals ?? []),
    promotionReadiness: {
      currentReleaseKind: String(report.promotionReadiness?.currentReleaseKind ?? '').trim(),
      currentRolloutStage: String(report.promotionReadiness?.currentRolloutStage ?? '').trim(),
      formalOrGaStatus: String(report.promotionReadiness?.formalOrGaStatus ?? '').trim(),
      stopShipSignals: normalizeStringList(report.promotionReadiness?.stopShipSignals ?? []),
    },
    codingServerOpenApiEvidence: normalizeStableCodingServerOpenApiEvidence(
      report.codingServerOpenApiEvidence ?? null,
    ),
    previewEvidence: normalizeStableOptionalSummary(report.previewEvidence ?? null),
    buildEvidence: normalizeStableOptionalSummary(report.buildEvidence ?? null),
    simulatorEvidence: normalizeStableOptionalSummary(report.simulatorEvidence ?? null),
    testEvidence: normalizeStableOptionalSummary(report.testEvidence ?? null),
    governanceEvidence: normalizeStableOptionalSummary(report.governanceEvidence ?? null),
    qualityEvidence: normalizeStableQualitySummary(report.qualityEvidence ?? {}),
  };
}

const rootDir = process.cwd();
const canonicalReleaseAssetsDir = path.join(rootDir, 'artifacts', 'release-openapi-canonical');
const canonicalManifestPath = path.join(canonicalReleaseAssetsDir, 'release-manifest.json');

if (!fs.existsSync(canonicalReleaseAssetsDir)) {
  console.log('release-openapi-canonical quality evidence contract skipped: canonical release assets directory missing.');
  process.exit(0);
}

assert.ok(
  fs.existsSync(canonicalManifestPath),
  'release-openapi-canonical quality evidence contract requires a finalized release-manifest.json.',
);

const packagedManifest = readJson(canonicalManifestPath);
assert.ok(
  Array.isArray(packagedManifest.qualityEvidence?.missingWorkflowBindings),
  'artifacts/release-openapi-canonical/release-manifest.json must preserve qualityEvidence.missingWorkflowBindings.',
);
assert.ok(
  Array.isArray(packagedManifest.qualityEvidence?.missingManifestBindings),
  'artifacts/release-openapi-canonical/release-manifest.json must preserve qualityEvidence.missingManifestBindings.',
);
const packagedExecutionReportPath = path.join(canonicalReleaseAssetsDir, 'quality', 'quality-gate-execution-report.json');
assert.ok(
  fs.existsSync(packagedExecutionReportPath),
  'release-openapi-canonical quality evidence contract requires a packaged quality-gate-execution-report.json.',
);
const packagedExecutionReport = readJson(packagedExecutionReportPath);
const packagedReportPath = path.join(canonicalReleaseAssetsDir, 'quality', 'quality-gate-matrix-report.json');
assert.ok(
  fs.existsSync(packagedReportPath),
  'release-openapi-canonical quality evidence contract requires a packaged quality-gate-matrix-report.json.',
);

const packagedReport = readJson(packagedReportPath);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-openapi-canonical-quality-'));
const freshReport = buildQualityGateMatrixReport({
  rootDir,
  outputPath: path.join(tempDir, 'quality-gate-matrix-report.json'),
});

assert.deepEqual(
  normalizeStableMatrixReport(packagedReport),
  normalizeStableMatrixReport(freshReport),
  'artifacts/release-openapi-canonical/quality/quality-gate-matrix-report.json must be regenerated after stable quality-tier, workflow, or manifest truth changes.',
);

const freshQualitySummary = summarizeQualityGateReleaseEvidence({
  ...freshReport,
  archiveRelativePath: 'quality/quality-gate-matrix-report.json',
}, {
  ...packagedExecutionReport,
  archiveRelativePath: 'quality/quality-gate-execution-report.json',
});

assert.deepEqual(
  normalizeStableQualitySummary(packagedManifest.qualityEvidence ?? {}),
  normalizeStableQualitySummary(freshQualitySummary),
  'artifacts/release-openapi-canonical/release-manifest.json must preserve the current stable packaged qualityEvidence summary.',
);
const packagedFinalizedSmokeReportPath = path.join(
  canonicalReleaseAssetsDir,
  'finalized-release-smoke-report.json',
);
assert.ok(
  fs.existsSync(packagedFinalizedSmokeReportPath),
  'release-openapi-canonical quality evidence contract requires a packaged finalized-release-smoke-report.json.',
);
const packagedFinalizedSmokeReport = readJson(packagedFinalizedSmokeReportPath);
const smokeTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-openapi-canonical-smoke-'));
const smokeReleaseAssetsDir = path.join(smokeTempDir, 'release-assets');
fs.cpSync(canonicalReleaseAssetsDir, smokeReleaseAssetsDir, { recursive: true });
const freshFinalizedSmokeReport = readJson(
  smokeFinalizedReleaseAssets({
    releaseAssetsDir: smokeReleaseAssetsDir,
  }).reportPath,
);
assert.deepEqual(
  normalizeStableFinalizedSmokeReport(packagedFinalizedSmokeReport),
  normalizeStableFinalizedSmokeReport(freshFinalizedSmokeReport),
  'artifacts/release-openapi-canonical/finalized-release-smoke-report.json must be regenerated after stable finalized-smoke truth changes.',
);

const releaseNotesPath = path.join(canonicalReleaseAssetsDir, 'release-notes.md');
assert.ok(
  fs.existsSync(releaseNotesPath),
  'release-openapi-canonical quality evidence contract requires a rendered release-notes.md.',
);

const releaseNotes = fs.readFileSync(releaseNotesPath, 'utf8');
assert.match(
  releaseNotes,
  /Finalized release readiness: `blocked`/,
  'canonical release notes must surface blocked finalized release readiness when stop-ship signals exist.',
);
assert.match(
  releaseNotes,
  /Finalized readiness signals: runtime blocked tiers `fast`; runtime blockers `vite-host-build-preflight`/,
  'canonical release notes must surface the finalized runtime stop-ship blockers in the top-level readiness summary.',
);
assert.match(
  releaseNotes,
  /Manifest-bound tiers: `3\/3`/,
  'canonical release notes must render the packaged manifest-bound tier count.',
);
assert.match(
  releaseNotes,
  /Runtime execution report: `quality\/quality-gate-execution-report\.json`/,
  'canonical release notes must render the packaged quality execution report path.',
);
assert.match(
  releaseNotes,
  /Runtime gate status: `blocked`/,
  'canonical release notes must render the packaged runtime gate status.',
);
assert.match(
  releaseNotes,
  /Stop-ship signals: .*runtime blocked tiers `fast`; runtime blockers `vite-host-build-preflight`/,
  'canonical release notes must include runtime blocked tiers and runtime blocking diagnostics in stop-ship signals.',
);
const checksumsPath = path.join(canonicalReleaseAssetsDir, 'SHA256SUMS.txt');
assert.ok(
  fs.existsSync(checksumsPath),
  'release-openapi-canonical quality evidence contract requires SHA256SUMS.txt.',
);
const releaseNotesSha256 = crypto
  .createHash('sha256')
  .update(releaseNotes)
  .digest('hex');
const finalizedSmokeReportSha256 = crypto
  .createHash('sha256')
  .update(fs.readFileSync(packagedFinalizedSmokeReportPath))
  .digest('hex');
assert.match(
  fs.readFileSync(checksumsPath, 'utf8'),
  new RegExp(`^${releaseNotesSha256}  release-notes\\.md$`, 'm'),
  'canonical SHA256SUMS.txt must preserve the current rendered release-notes.md digest.',
);
assert.match(
  fs.readFileSync(checksumsPath, 'utf8'),
  new RegExp(`^${finalizedSmokeReportSha256}  finalized-release-smoke-report\\.json$`, 'm'),
  'canonical SHA256SUMS.txt must preserve the current finalized-release-smoke-report.json digest.',
);

console.log('release-openapi-canonical quality evidence contract passed.');
