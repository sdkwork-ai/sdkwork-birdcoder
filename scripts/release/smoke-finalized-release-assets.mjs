#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  summarizeStudioBuildEvidenceArchive,
} from './studio-build-evidence-archive.mjs';
import {
  summarizeStudioPreviewEvidenceArchive,
} from './studio-preview-evidence-archive.mjs';
import {
  summarizeStudioSimulatorEvidenceArchive,
} from './studio-simulator-evidence-archive.mjs';
import {
  summarizeStudioTestEvidenceArchive,
} from './studio-test-evidence-archive.mjs';
import {
  enrichQualityEvidenceSummary,
  normalizeQualityEvidenceSummary,
  readReleaseQualityEvidence,
} from './quality-gate-release-evidence.mjs';
import {
  createCodingServerOpenApiEvidence,
  normalizeCodingServerOpenApiEvidenceSummary,
} from './coding-server-openapi-release-evidence.mjs';
import {
  assertClearStopShipEvidence,
  buildPromotionReadinessSummary,
  collectReleaseStopShipSignals,
  normalizePromotionReadinessSummary,
  normalizeStopShipSignals,
} from './release-stop-ship-governance.mjs';
import {
  collectDesktopStartupReadinessSignals,
  normalizeDesktopStartupReadinessSummary,
  resolveDesktopAssetTargetLabel,
  summarizeDesktopStartupReadiness,
} from './desktop-startup-readiness-summary.mjs';
import {
  resolveDesktopStartupEvidencePath,
} from './desktop-startup-smoke-contract.mjs';
import {
  refreshReleaseChecksumsIfPresent,
} from './release-checksums.mjs';

export const FINALIZED_RELEASE_SMOKE_REPORT_FILENAME = 'finalized-release-smoke-report.json';

function normalizeStringArray(values) {
  return Array.from(new Set(
    values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean),
  )).sort((left, right) => left.localeCompare(right));
}

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();
  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

export function resolveFinalizedReleaseSmokeReportPath({
  releaseAssetsDir,
} = {}) {
  return path.join(releaseAssetsDir, FINALIZED_RELEASE_SMOKE_REPORT_FILENAME);
}

function parseArgs(argv) {
  const options = {
    releaseAssetsDir: path.join(process.cwd(), 'artifacts', 'release'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = path.resolve(readOptionValue(argv, index, '--release-assets-dir'));
      index += 1;
    }
  }

  return options;
}

function normalizePreviewEvidenceSummary(summary = {}) {
  return {
    archiveRelativePath: String(summary.archiveRelativePath ?? '').trim(),
    entryCount: typeof summary.entryCount === 'number' ? summary.entryCount : 0,
    channels: normalizeStringArray(summary.channels ?? []),
    projectIds: normalizeStringArray(summary.projectIds ?? []),
    latestLaunchedAt: typeof summary.latestLaunchedAt === 'number' ? summary.latestLaunchedAt : null,
  };
}

function normalizeBuildEvidenceSummary(summary = {}) {
  return {
    archiveRelativePath: String(summary.archiveRelativePath ?? '').trim(),
    entryCount: typeof summary.entryCount === 'number' ? summary.entryCount : 0,
    targets: normalizeStringArray(summary.targets ?? []),
    outputKinds: normalizeStringArray(summary.outputKinds ?? []),
    projectIds: normalizeStringArray(summary.projectIds ?? []),
    latestLaunchedAt: typeof summary.latestLaunchedAt === 'number' ? summary.latestLaunchedAt : null,
  };
}

function normalizeSimulatorEvidenceSummary(summary = {}) {
  return {
    archiveRelativePath: String(summary.archiveRelativePath ?? '').trim(),
    entryCount: typeof summary.entryCount === 'number' ? summary.entryCount : 0,
    channels: normalizeStringArray(summary.channels ?? []),
    runtimes: normalizeStringArray(summary.runtimes ?? []),
    projectIds: normalizeStringArray(summary.projectIds ?? []),
    latestLaunchedAt: typeof summary.latestLaunchedAt === 'number' ? summary.latestLaunchedAt : null,
  };
}

function normalizeTestEvidenceSummary(summary = {}) {
  return {
    archiveRelativePath: String(summary.archiveRelativePath ?? '').trim(),
    entryCount: typeof summary.entryCount === 'number' ? summary.entryCount : 0,
    commands: normalizeStringArray(summary.commands ?? []),
    projectIds: normalizeStringArray(summary.projectIds ?? []),
    latestLaunchedAt: typeof summary.latestLaunchedAt === 'number' ? summary.latestLaunchedAt : null,
  };
}

function normalizeQualitySummary(summary = {}) {
  return normalizeQualityEvidenceSummary(summary);
}

function normalizeCodingServerOpenApiSummary(summary = {}) {
  return normalizeCodingServerOpenApiEvidenceSummary(summary);
}

function assertOptionalSummaryMatches({
  manifestSummary,
  archiveSummary,
  normalizeSummary,
  missingArchiveMessage,
  mismatchMessage,
} = {}) {
  if (!manifestSummary) {
    return null;
  }

  if (!archiveSummary) {
    throw new Error(missingArchiveMessage);
  }

  const normalizedManifestSummary = normalizeSummary(manifestSummary);
  const normalizedArchiveSummary = normalizeSummary(archiveSummary);
  const mismatch = JSON.stringify(normalizedManifestSummary) !== JSON.stringify(normalizedArchiveSummary);
  if (mismatch) {
    throw new Error(mismatchMessage);
  }

  return normalizedArchiveSummary;
}

function assertRequiredSummaryMatches({
  manifestSummary,
  archiveSummary,
  normalizeSummary,
  missingManifestMessage,
  missingArchiveMessage,
  mismatchMessage,
} = {}) {
  if (!manifestSummary) {
    throw new Error(missingManifestMessage);
  }

  return assertOptionalSummaryMatches({
    manifestSummary,
    archiveSummary,
    normalizeSummary,
    missingArchiveMessage,
    mismatchMessage,
  });
}

function assertPreviewEvidenceSummaryMatches({
  manifest,
  releaseAssetsDir,
} = {}) {
  return assertOptionalSummaryMatches({
    manifestSummary: manifest.previewEvidence,
    archiveSummary: summarizeStudioPreviewEvidenceArchive({
      releaseAssetsDir,
    }),
    normalizeSummary: normalizePreviewEvidenceSummary,
    missingArchiveMessage: `Missing studio preview evidence archive referenced by finalized manifest: ${releaseAssetsDir}`,
    mismatchMessage: 'Finalized manifest previewEvidence summary does not match the studio preview evidence archive.',
  });
}

function assertBuildEvidenceSummaryMatches({
  manifest,
  releaseAssetsDir,
} = {}) {
  return assertOptionalSummaryMatches({
    manifestSummary: manifest.buildEvidence,
    archiveSummary: summarizeStudioBuildEvidenceArchive({
      releaseAssetsDir,
    }),
    normalizeSummary: normalizeBuildEvidenceSummary,
    missingArchiveMessage: `Missing studio build evidence archive referenced by finalized manifest: ${releaseAssetsDir}`,
    mismatchMessage: 'Finalized manifest buildEvidence summary does not match the studio build evidence archive.',
  });
}

function assertSimulatorEvidenceSummaryMatches({
  manifest,
  releaseAssetsDir,
} = {}) {
  return assertOptionalSummaryMatches({
    manifestSummary: manifest.simulatorEvidence,
    archiveSummary: summarizeStudioSimulatorEvidenceArchive({
      releaseAssetsDir,
    }),
    normalizeSummary: normalizeSimulatorEvidenceSummary,
    missingArchiveMessage: `Missing studio simulator evidence archive referenced by finalized manifest: ${releaseAssetsDir}`,
    mismatchMessage: 'Finalized manifest simulatorEvidence summary does not match the studio simulator evidence archive.',
  });
}

function assertTestEvidenceSummaryMatches({
  manifest,
  releaseAssetsDir,
} = {}) {
  return assertOptionalSummaryMatches({
    manifestSummary: manifest.testEvidence,
    archiveSummary: summarizeStudioTestEvidenceArchive({
      releaseAssetsDir,
    }),
    normalizeSummary: normalizeTestEvidenceSummary,
    missingArchiveMessage: `Missing studio test evidence archive referenced by finalized manifest: ${releaseAssetsDir}`,
    mismatchMessage: 'Finalized manifest testEvidence summary does not match the studio test evidence archive.',
  });
}

function assertCodingServerOpenApiEvidenceSummaryMatches({
  manifest,
  releaseAssetsDir,
} = {}) {
  const archiveSummary = createCodingServerOpenApiEvidence({
    releaseAssetsDir,
    assets: manifest.assets,
  });
  if (!archiveSummary) {
    if (manifest.codingServerOpenApiEvidence) {
      throw new Error('Finalized manifest codingServerOpenApiEvidence summary is present without packaged server OpenAPI assets.');
    }
    return null;
  }

  return assertRequiredSummaryMatches({
    manifestSummary: manifest.codingServerOpenApiEvidence,
    archiveSummary,
    normalizeSummary: normalizeCodingServerOpenApiSummary,
    missingManifestMessage: 'Missing finalized manifest codingServerOpenApiEvidence summary.',
    missingArchiveMessage: `Missing packaged coding-server OpenAPI snapshot referenced by finalized manifest: ${releaseAssetsDir}`,
    mismatchMessage: 'Finalized manifest codingServerOpenApiEvidence summary does not match the packaged coding-server OpenAPI snapshot.',
  });
}

function assertQualityEvidenceSummaryMatches({
  manifest,
  releaseAssetsDir,
} = {}) {
  const qualityEvidence = readReleaseQualityEvidence({
    releaseAssetsDir,
  });

  return assertRequiredSummaryMatches({
    manifestSummary: manifest.qualityEvidence,
    archiveSummary: enrichQualityEvidenceSummary(
      qualityEvidence?.summary ?? {},
      {
        releaseReadinessSignals: collectDesktopStartupReadinessSignals(manifest.assets),
      },
    ),
    normalizeSummary: normalizeQualitySummary,
    missingManifestMessage: 'Missing finalized manifest qualityEvidence summary.',
    missingArchiveMessage: `Missing quality gate matrix report referenced by finalized manifest: ${releaseAssetsDir}`,
    mismatchMessage: 'Finalized manifest qualityEvidence summary does not match the quality gate matrix report.',
  });
}

function assertDesktopStartupReadinessSummaryMatches({
  manifest,
  releaseAssetsDir,
} = {}) {
  const desktopAssets = (manifest.assets ?? []).filter((entry) => String(entry?.family ?? '').trim() === 'desktop');
  if (desktopAssets.length === 0) {
    return [];
  }

  return desktopAssets.map((entry) => {
    const target = resolveDesktopAssetTargetLabel(entry);
    if (!entry.desktopStartupReadinessSummary) {
      throw new Error(`Missing finalized manifest desktopStartupReadinessSummary for packaged desktop asset: ${target}.`);
    }

    const capturedEvidenceRelativePath = String(
      entry.desktopStartupEvidence?.capturedEvidenceRelativePath ?? '',
    ).trim();
    const startupEvidencePath = capturedEvidenceRelativePath
      ? path.join(releaseAssetsDir, capturedEvidenceRelativePath)
      : resolveDesktopStartupEvidencePath({
        releaseAssetsDir,
        platform: entry.platform,
        arch: entry.arch,
      });

    if (!fs.existsSync(startupEvidencePath)) {
      throw new Error(`Missing packaged desktop startup evidence referenced by finalized manifest: ${startupEvidencePath}`);
    }

    const startupEvidence = JSON.parse(fs.readFileSync(startupEvidencePath, 'utf8'));
    const normalizedManifestSummary = normalizeDesktopStartupReadinessSummary(
      entry.desktopStartupReadinessSummary,
    );
    const normalizedEvidenceSummary = normalizeDesktopStartupReadinessSummary(
      summarizeDesktopStartupReadiness(startupEvidence.readinessEvidence) ?? {},
    );

    if (JSON.stringify(normalizedManifestSummary) !== JSON.stringify(normalizedEvidenceSummary)) {
      throw new Error(`Finalized manifest desktopStartupReadinessSummary does not match the packaged desktop startup evidence for ${target}.`);
    }

    return {
      target,
      ...normalizedEvidenceSummary,
    };
  });
}

function assertStopShipSignalsSummaryMatches({
  manifest,
  qualityEvidence,
} = {}) {
  return assertRequiredSummaryMatches({
    manifestSummary: manifest.stopShipSignals,
    archiveSummary: collectReleaseStopShipSignals({
      qualityEvidence,
      assets: manifest.assets,
    }),
    normalizeSummary: normalizeStopShipSignals,
    missingManifestMessage: 'Missing finalized manifest stopShipSignals summary.',
    missingArchiveMessage: 'Missing recomputed stopShipSignals summary.',
    mismatchMessage: 'Finalized manifest stopShipSignals summary does not match recomputed release stop-ship signals.',
  });
}

function assertPromotionReadinessSummaryMatches({
  manifest,
  stopShipSignals,
} = {}) {
  return assertRequiredSummaryMatches({
    manifestSummary: manifest.promotionReadiness,
    archiveSummary: buildPromotionReadinessSummary({
      releaseControl: manifest.releaseControl ?? null,
      stopShipSignals,
    }),
    normalizeSummary: normalizePromotionReadinessSummary,
    missingManifestMessage: 'Missing finalized manifest promotionReadiness summary.',
    missingArchiveMessage: 'Missing recomputed promotionReadiness summary.',
    mismatchMessage: 'Finalized manifest promotionReadiness summary does not match recomputed release promotion readiness.',
  });
}

export function smokeFinalizedReleaseAssets({
  releaseAssetsDir = path.join(process.cwd(), 'artifacts', 'release'),
} = {}) {
  const manifestPath = path.join(releaseAssetsDir, 'release-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing finalized release manifest: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.assets)) {
    throw new Error(`Invalid finalized release manifest at ${manifestPath}: assets must be an array.`);
  }

  const previewEvidence = assertPreviewEvidenceSummaryMatches({
    manifest,
    releaseAssetsDir,
  });
  const codingServerOpenApiEvidence = assertCodingServerOpenApiEvidenceSummaryMatches({
    manifest,
    releaseAssetsDir,
  });
  const buildEvidence = assertBuildEvidenceSummaryMatches({
    manifest,
    releaseAssetsDir,
  });
  const simulatorEvidence = assertSimulatorEvidenceSummaryMatches({
    manifest,
    releaseAssetsDir,
  });
  const testEvidence = assertTestEvidenceSummaryMatches({
    manifest,
    releaseAssetsDir,
  });
  const desktopStartupReadiness = assertDesktopStartupReadinessSummaryMatches({
    manifest,
    releaseAssetsDir,
  });
  const qualityEvidence = assertQualityEvidenceSummaryMatches({
    manifest,
    releaseAssetsDir,
  });
  const stopShipSignals = assertStopShipSignalsSummaryMatches({
    manifest,
    qualityEvidence,
  });
  const promotionReadiness = assertPromotionReadinessSummaryMatches({
    manifest,
    stopShipSignals,
  });
  assertClearStopShipEvidence({
    releaseControl: manifest.releaseControl ?? null,
    qualityEvidence,
    assets: manifest.assets,
    errorPrefix: 'Formal or general-availability finalized release manifests require clear stop-ship evidence',
  });

  const reportPath = resolveFinalizedReleaseSmokeReportPath({
    releaseAssetsDir,
  });
  const report = {
    status: 'passed',
    verifiedAt: new Date().toISOString(),
    manifestPath: path.resolve(manifestPath),
    checks: [
      {
        id: 'finalized-manifest-present',
        status: 'passed',
        detail: 'finalized release manifest exists and can be parsed',
      },
      {
        id: 'coding-server-openapi-evidence-summary-match',
        status: codingServerOpenApiEvidence ? 'passed' : 'skipped',
        detail: codingServerOpenApiEvidence
          ? 'finalized manifest codingServerOpenApiEvidence summary matches the packaged coding-server OpenAPI snapshot'
          : 'no packaged server OpenAPI snapshot is attached to the finalized release manifest',
      },
      {
        id: 'preview-evidence-summary-match',
        status: previewEvidence ? 'passed' : 'skipped',
        detail: previewEvidence
          ? 'finalized manifest previewEvidence summary matches the studio preview evidence archive'
          : 'no studio preview evidence archive is attached to the finalized release manifest',
      },
      {
        id: 'build-evidence-summary-match',
        status: buildEvidence ? 'passed' : 'skipped',
        detail: buildEvidence
          ? 'finalized manifest buildEvidence summary matches the studio build evidence archive'
          : 'no studio build evidence archive is attached to the finalized release manifest',
      },
      {
        id: 'simulator-evidence-summary-match',
        status: simulatorEvidence ? 'passed' : 'skipped',
        detail: simulatorEvidence
          ? 'finalized manifest simulatorEvidence summary matches the studio simulator evidence archive'
          : 'no studio simulator evidence archive is attached to the finalized release manifest',
      },
      {
        id: 'test-evidence-summary-match',
        status: testEvidence ? 'passed' : 'skipped',
        detail: testEvidence
          ? 'finalized manifest testEvidence summary matches the studio test evidence archive'
          : 'no studio test evidence archive is attached to the finalized release manifest',
      },
      {
        id: 'desktop-startup-readiness-summary-match',
        status: desktopStartupReadiness.length > 0 ? 'passed' : 'skipped',
        detail: desktopStartupReadiness.length > 0
          ? 'finalized manifest desktopStartupReadinessSummary matches the packaged desktop startup evidence'
          : 'no packaged desktop startup evidence is attached to the finalized release manifest',
      },
      {
        id: 'quality-evidence-summary-match',
        status: 'passed',
        detail: 'finalized manifest qualityEvidence summary matches the quality gate matrix report',
      },
    ],
    codingServerOpenApiEvidence: codingServerOpenApiEvidence ?? null,
    previewEvidence: previewEvidence ?? null,
    buildEvidence: buildEvidence ?? null,
    simulatorEvidence: simulatorEvidence ?? null,
    testEvidence: testEvidence ?? null,
    desktopStartupReadiness,
    qualityEvidence: qualityEvidence ?? null,
    stopShipSignals,
    promotionReadiness,
  };

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  refreshReleaseChecksumsIfPresent({
    releaseAssetsDir,
    checksumFileName: String(manifest.checksumFileName ?? 'SHA256SUMS.txt').trim() || 'SHA256SUMS.txt',
  });

  return {
    manifestPath,
    reportPath,
    codingServerOpenApiEvidence,
    previewEvidence,
    buildEvidence,
    simulatorEvidence,
    testEvidence,
    desktopStartupReadiness,
    qualityEvidence,
    stopShipSignals,
    promotionReadiness,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = smokeFinalizedReleaseAssets(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
