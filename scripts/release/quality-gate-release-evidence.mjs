import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { buildQualityGateMatrixReport } from '../quality-gate-matrix-report.mjs';

export const RELEASE_QUALITY_EVIDENCE_DIR = 'quality';
export const RELEASE_QUALITY_EVIDENCE_FILENAME = 'quality-gate-matrix-report.json';
export const RELEASE_QUALITY_EXECUTION_EVIDENCE_FILENAME = 'quality-gate-execution-report.json';
const LOOP_SCORE_ITEMS = Object.freeze([
  'architecture_alignment',
  'implementation_completeness',
  'test_closure',
  'commercial_readiness',
]);

function normalizeStringList(values) {
  const normalized = [];
  const seen = new Set();
  for (const value of values ?? []) {
    const candidate = String(value ?? '').trim();
    if (!candidate || seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    normalized.push(candidate);
  }

  return normalized;
}

function normalizeBlockingDiagnostic(diagnostic = {}) {
  return {
    id: String(diagnostic.id ?? '').trim(),
    label: String(diagnostic.label ?? '').trim(),
    classification: String(diagnostic.classification ?? '').trim(),
    appliesTo: normalizeStringList(diagnostic.appliesTo ?? []),
    summary: String(diagnostic.summary ?? '').trim(),
    requiredCapabilities: normalizeStringList(diagnostic.requiredCapabilities ?? []),
    rerunCommands: normalizeStringList(diagnostic.rerunCommands ?? []),
  };
}

function clampScore(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  if (numericValue <= 0) {
    return 0;
  }
  if (numericValue >= 100) {
    return 100;
  }

  return Math.round(numericValue);
}

function resolveLowestScoreItem(scoreboard = {}) {
  return LOOP_SCORE_ITEMS.reduce((lowestItem, candidateItem) => {
    if (!lowestItem) {
      return candidateItem;
    }

    const lowestValue = Number(scoreboard[lowestItem] ?? 0);
    const candidateValue = Number(scoreboard[candidateItem] ?? 0);
    if (candidateValue < lowestValue) {
      return candidateItem;
    }

    return lowestItem;
  }, '');
}

function buildLoopScoreboardNextFocus({
  lowestScoreItem = '',
  summary = {},
} = {}) {
  if (lowestScoreItem === 'architecture_alignment') {
    return 'Close workflow-binding or contract-drift gaps before adding new delivery slices.';
  }

  if (lowestScoreItem === 'implementation_completeness') {
    return 'Promote missing shared-facade or release-governance slices before expanding scope.';
  }

  if (lowestScoreItem === 'test_closure') {
    return 'Close blocked or failed quality tiers before claiming release readiness.';
  }

  if (lowestScoreItem === 'commercial_readiness') {
    const blockingDiagnosticIds = normalizeStringList(summary.blockingDiagnosticIds ?? []);
    if (blockingDiagnosticIds.length > 0) {
      return `Clear blocking diagnostics (${blockingDiagnosticIds.map((diagnosticId) => `\`${diagnosticId}\``).join(', ')}) and rerun quality gates.`;
    }

    return 'Close remaining release-readiness blockers and rerun quality gates.';
  }

  return 'Keep the lowest-score lane as the only serial next focus.';
}

export function summarizeQualityLoopScoreboard(summary = {}) {
  const totalTiers = Math.max(1, Number(summary.totalTiers ?? 0));
  const workflowBoundTiers = Math.max(0, Number(summary.workflowBoundTiers ?? 0));
  const tierIds = normalizeStringList(summary.tierIds ?? []);
  const releaseGovernanceCheckIds = normalizeStringList(summary.releaseGovernanceCheckIds ?? []);
  const blockingDiagnosticIds = normalizeStringList(summary.blockingDiagnosticIds ?? []);
  const executionStatus = String(summary.executionStatus ?? '').trim().toLowerCase();
  const executionBlockingTierIds = normalizeStringList(summary.executionBlockingTierIds ?? []);
  const executionFailedTierIds = normalizeStringList(summary.executionFailedTierIds ?? []);
  const executionSkippedTierIds = normalizeStringList(summary.executionSkippedTierIds ?? []);

  const architectureAlignment = clampScore((workflowBoundTiers / totalTiers) * 100);
  const implementationCoverage = Math.min(tierIds.length / 3, 1);
  const governanceCoverage = Math.min(releaseGovernanceCheckIds.length / 4, 1);
  const implementationCompleteness = clampScore(
    ((implementationCoverage * 0.6) + (governanceCoverage * 0.4)) * 100,
  );

  let testPenalty = (executionFailedTierIds.length * 35)
    + (executionBlockingTierIds.length * 20)
    + (executionSkippedTierIds.length * 10);
  if (!executionStatus) {
    testPenalty = blockingDiagnosticIds.length * 15;
  }
  if (executionStatus === 'failed') {
    testPenalty += 10;
  }
  const testClosure = clampScore(100 - testPenalty);

  let commercialPenalty = blockingDiagnosticIds.length * 25;
  if (executionStatus === 'blocked') {
    commercialPenalty += 15;
  } else if (executionStatus === 'failed') {
    commercialPenalty += 30;
  }
  const commercialReadiness = clampScore(100 - commercialPenalty);

  const scoreboard = {
    architecture_alignment: architectureAlignment,
    implementation_completeness: implementationCompleteness,
    test_closure: testClosure,
    commercial_readiness: commercialReadiness,
  };
  const lowestScoreItem = resolveLowestScoreItem(scoreboard);

  return {
    ...scoreboard,
    lowest_score_item: lowestScoreItem,
    next_focus: buildLoopScoreboardNextFocus({
      lowestScoreItem,
      summary: {
        ...summary,
        ...scoreboard,
      },
    }),
  };
}

function normalizeLoopScoreboard(loopScoreboard = null, fallbackSummary = {}) {
  const fallback = summarizeQualityLoopScoreboard(fallbackSummary);
  if (!loopScoreboard || typeof loopScoreboard !== 'object') {
    return fallback;
  }

  const normalized = {
    architecture_alignment: clampScore(loopScoreboard.architecture_alignment),
    implementation_completeness: clampScore(loopScoreboard.implementation_completeness),
    test_closure: clampScore(loopScoreboard.test_closure),
    commercial_readiness: clampScore(loopScoreboard.commercial_readiness),
  };
  const requestedLowestScoreItem = String(loopScoreboard.lowest_score_item ?? '').trim();
  const lowestScoreItem = LOOP_SCORE_ITEMS.includes(requestedLowestScoreItem)
    ? requestedLowestScoreItem
    : resolveLowestScoreItem(normalized);
  const nextFocus = String(loopScoreboard.next_focus ?? '').trim() || buildLoopScoreboardNextFocus({
    lowestScoreItem,
    summary: {
      ...fallbackSummary,
      ...normalized,
    },
  });

  return {
    ...normalized,
    lowest_score_item: lowestScoreItem,
    next_focus: nextFocus,
  };
}

export function resolveReleaseQualityEvidencePath({ releaseAssetsDir } = {}) {
  return path.join(
    releaseAssetsDir,
    RELEASE_QUALITY_EVIDENCE_DIR,
    RELEASE_QUALITY_EVIDENCE_FILENAME,
  );
}

export function resolveReleaseQualityExecutionEvidencePath({ releaseAssetsDir } = {}) {
  return path.join(
    releaseAssetsDir,
    RELEASE_QUALITY_EVIDENCE_DIR,
    RELEASE_QUALITY_EXECUTION_EVIDENCE_FILENAME,
  );
}

function summarizeQualityExecutionEvidence(report = {}) {
  const status = String(report.status ?? '').trim();
  if (!status) {
    return null;
  }

  return {
    executionArchiveRelativePath: String(
      report.archiveRelativePath
      ?? path.join(RELEASE_QUALITY_EVIDENCE_DIR, RELEASE_QUALITY_EXECUTION_EVIDENCE_FILENAME),
    ).trim().split(path.sep).join('/'),
    executionStatus: status,
    lastExecutedTierId: String(report.summary?.lastExecutedTierId ?? '').trim(),
    executionBlockingTierIds: normalizeStringList(report.summary?.blockingTierIds ?? []),
    executionFailedTierIds: normalizeStringList(report.summary?.failedTierIds ?? []),
    executionSkippedTierIds: normalizeStringList(report.summary?.skippedTierIds ?? []),
    executionBlockingDiagnosticIds: normalizeStringList(report.summary?.blockingDiagnosticIds ?? []),
  };
}

export function summarizeQualityGateReleaseEvidence(report = {}, executionReport = null) {
  const releaseTier = (report.tiers ?? []).find((tier) => String(tier?.id ?? '').trim() === 'release') ?? null;
  const summary = {
    archiveRelativePath: String(
      report.archiveRelativePath
      ?? path.join(RELEASE_QUALITY_EVIDENCE_DIR, RELEASE_QUALITY_EVIDENCE_FILENAME),
    ).trim().split(path.sep).join('/'),
    totalTiers: typeof report.summary?.totalTiers === 'number' ? report.summary.totalTiers : 0,
    workflowBoundTiers: typeof report.summary?.workflowBoundTiers === 'number'
      ? report.summary.workflowBoundTiers
      : 0,
    tierIds: normalizeStringList((report.tiers ?? []).map((tier) => tier?.id)),
    failureClassificationIds: normalizeStringList(
      (report.failureClassifications ?? []).map((classification) => classification?.id),
    ),
    environmentDiagnostics: typeof report.summary?.environmentDiagnostics === 'number'
      ? report.summary.environmentDiagnostics
      : 0,
    blockingDiagnosticIds: normalizeStringList(report.summary?.blockingDiagnosticIds ?? []),
    releaseGovernanceCheckIds: normalizeStringList(releaseTier?.governanceCheckIds ?? []),
    blockingDiagnostics: (report.environmentDiagnostics ?? [])
      .filter((diagnostic) => String(diagnostic?.status ?? '').trim() === 'blocked')
      .map((diagnostic) => normalizeBlockingDiagnostic(diagnostic)),
  };

  const executionSummary = summarizeQualityExecutionEvidence(executionReport ?? {});
  if (executionSummary) {
    Object.assign(summary, executionSummary);
  }

  summary.loopScoreboard = summarizeQualityLoopScoreboard(summary);

  return summary;
}

function copyOptionalExecutionReport({
  releaseAssetsDir,
  qualityExecutionReportPath = '',
} = {}) {
  const normalizedSourcePath = String(qualityExecutionReportPath ?? '').trim();
  if (!normalizedSourcePath) {
    return null;
  }

  const resolvedSourcePath = path.resolve(process.cwd(), normalizedSourcePath);
  if (!fs.existsSync(resolvedSourcePath)) {
    return null;
  }

  const reportPath = resolveReleaseQualityExecutionEvidencePath({
    releaseAssetsDir,
  });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });

  if (path.resolve(reportPath) !== path.resolve(resolvedSourcePath)) {
    fs.copyFileSync(resolvedSourcePath, reportPath);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  return {
    reportPath,
    report,
  };
}

export function createReleaseQualityEvidence({
  rootDir = process.cwd(),
  releaseAssetsDir,
  qualityExecutionReportPath = '',
} = {}) {
  const reportPath = resolveReleaseQualityEvidencePath({
    releaseAssetsDir,
  });
  const report = buildQualityGateMatrixReport({
    rootDir,
    outputPath: reportPath,
  });
  const executionEvidence = copyOptionalExecutionReport({
    releaseAssetsDir,
    qualityExecutionReportPath,
  });

  return {
    reportPath,
    report,
    executionEvidence,
    summary: summarizeQualityGateReleaseEvidence(
      {
        ...report,
        archiveRelativePath: path.relative(releaseAssetsDir, report.reportPath).split(path.sep).join('/'),
      },
      executionEvidence
        ? {
            ...executionEvidence.report,
            archiveRelativePath: path.relative(releaseAssetsDir, executionEvidence.reportPath).split(path.sep).join('/'),
          }
        : null,
    ),
  };
}

export function readReleaseQualityEvidence({
  releaseAssetsDir,
} = {}) {
  const reportPath = resolveReleaseQualityEvidencePath({
    releaseAssetsDir,
  });
  if (!fs.existsSync(reportPath)) {
    return null;
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const executionReportPath = resolveReleaseQualityExecutionEvidencePath({
    releaseAssetsDir,
  });
  const executionEvidence = fs.existsSync(executionReportPath)
    ? {
        reportPath: executionReportPath,
        report: JSON.parse(fs.readFileSync(executionReportPath, 'utf8')),
      }
    : null;

  return {
    reportPath,
    report,
    executionEvidence,
    summary: summarizeQualityGateReleaseEvidence(
      {
        ...report,
        archiveRelativePath: path.relative(releaseAssetsDir, reportPath).split(path.sep).join('/'),
      },
      executionEvidence
        ? {
            ...executionEvidence.report,
            archiveRelativePath: path.relative(releaseAssetsDir, executionEvidence.reportPath).split(path.sep).join('/'),
          }
        : null,
    ),
  };
}

export function normalizeQualityEvidenceSummary(summary = {}) {
  const normalized = {
    archiveRelativePath: String(summary.archiveRelativePath ?? '').trim().split(path.sep).join('/'),
    totalTiers: typeof summary.totalTiers === 'number' ? summary.totalTiers : 0,
    workflowBoundTiers: typeof summary.workflowBoundTiers === 'number'
      ? summary.workflowBoundTiers
      : 0,
    tierIds: normalizeStringList(summary.tierIds ?? []),
    failureClassificationIds: normalizeStringList(summary.failureClassificationIds ?? []),
    environmentDiagnostics: typeof summary.environmentDiagnostics === 'number'
      ? summary.environmentDiagnostics
      : 0,
    blockingDiagnosticIds: normalizeStringList(summary.blockingDiagnosticIds ?? []),
    releaseGovernanceCheckIds: normalizeStringList(summary.releaseGovernanceCheckIds ?? []),
    blockingDiagnostics: (summary.blockingDiagnostics ?? [])
      .map((diagnostic) => normalizeBlockingDiagnostic(diagnostic)),
  };

  const executionArchiveRelativePath = String(summary.executionArchiveRelativePath ?? '')
    .trim()
    .split(path.sep)
    .join('/');
  if (executionArchiveRelativePath) {
    normalized.executionArchiveRelativePath = executionArchiveRelativePath;
  }

  const executionStatus = String(summary.executionStatus ?? '').trim();
  if (executionStatus) {
    normalized.executionStatus = executionStatus;
  }

  const lastExecutedTierId = String(summary.lastExecutedTierId ?? '').trim();
  if (lastExecutedTierId) {
    normalized.lastExecutedTierId = lastExecutedTierId;
  }

  const executionBlockingTierIds = normalizeStringList(summary.executionBlockingTierIds ?? []);
  if (executionBlockingTierIds.length > 0) {
    normalized.executionBlockingTierIds = executionBlockingTierIds;
  }

  const executionFailedTierIds = normalizeStringList(summary.executionFailedTierIds ?? []);
  if (executionFailedTierIds.length > 0) {
    normalized.executionFailedTierIds = executionFailedTierIds;
  }

  const executionSkippedTierIds = normalizeStringList(summary.executionSkippedTierIds ?? []);
  if (executionSkippedTierIds.length > 0) {
    normalized.executionSkippedTierIds = executionSkippedTierIds;
  }

  const executionBlockingDiagnosticIds = normalizeStringList(summary.executionBlockingDiagnosticIds ?? []);
  if (executionBlockingDiagnosticIds.length > 0) {
    normalized.executionBlockingDiagnosticIds = executionBlockingDiagnosticIds;
  }

  normalized.loopScoreboard = normalizeLoopScoreboard(summary.loopScoreboard ?? null, normalized);

  return normalized;
}
