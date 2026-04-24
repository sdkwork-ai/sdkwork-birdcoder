import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  DESKTOP_INSTALLER_SMOKE_REPORT_FILENAME,
  resolveDesktopInstallerSmokeReportPath,
} from './desktop-installer-smoke-contract.mjs';
import {
  DESKTOP_STARTUP_EVIDENCE_FILENAME,
  DESKTOP_STARTUP_SMOKE_REPORT_FILENAME,
  resolveDesktopStartupEvidencePath,
  resolveDesktopStartupSmokeReportPath,
} from './desktop-startup-smoke-contract.mjs';
import {
  DEFAULT_RELEASE_PROFILE_ID,
  RELEASE_ASSET_MANIFEST_FILE_NAME,
  resolveReleaseProfile,
} from './release-profiles.mjs';
import { resolveReleaseControl } from './resolve-release-plan.mjs';
import {
  readReleaseSmokeReport,
  resolveReleaseSmokeReportPath,
} from './release-smoke-contract.mjs';
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
  createReleaseQualityEvidence,
  enrichQualityEvidenceSummary,
} from './quality-gate-release-evidence.mjs';
import {
  createCodingServerOpenApiEvidence,
} from './coding-server-openapi-release-evidence.mjs';
import {
  assertClearStopShipEvidence,
  buildPromotionReadinessSummary,
  collectReleaseStopShipSignals,
} from './release-stop-ship-governance.mjs';
import {
  collectDesktopStartupReadinessSignals,
  summarizeDesktopStartupReadiness,
} from './desktop-startup-readiness-summary.mjs';

function parseOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      options[key] = 'true';
      continue;
    }

    options[key] = value;
    index += 1;
  }
  return options;
}

function walkFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  const files = [];
  const stack = [directoryPath];
  while (stack.length > 0) {
    const currentPath = stack.pop();
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }

      files.push(absolutePath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function computeSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function toRelativePath(baseDir, targetPath) {
  return path.relative(baseDir, targetPath).split(path.sep).join('/');
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureExistingJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }

  return readJsonFile(filePath);
}

function normalizeStatus(status) {
  return String(status ?? '').trim().toLowerCase();
}

function normalizeDesktopSmokeMetadata({
  releaseAssetsDir,
  descriptor,
} = {}) {
  const installerReportPath = resolveDesktopInstallerSmokeReportPath({
    releaseAssetsDir,
    platform: descriptor.platform,
    arch: descriptor.arch,
  });
  const startupReportPath = resolveDesktopStartupSmokeReportPath({
    releaseAssetsDir,
    platform: descriptor.platform,
    arch: descriptor.arch,
  });
  const startupEvidencePath = resolveDesktopStartupEvidencePath({
    releaseAssetsDir,
    platform: descriptor.platform,
    arch: descriptor.arch,
  });

  const installerReport = ensureExistingJson(
    installerReportPath,
    DESKTOP_INSTALLER_SMOKE_REPORT_FILENAME,
  );
  const startupReport = ensureExistingJson(
    startupReportPath,
    DESKTOP_STARTUP_SMOKE_REPORT_FILENAME,
  );
  const startupEvidence = ensureExistingJson(
    startupEvidencePath,
    DESKTOP_STARTUP_EVIDENCE_FILENAME,
  );

  if (normalizeStatus(startupReport.status) !== 'passed') {
    throw new Error(`Desktop startup smoke must pass before finalize: ${startupReportPath}`);
  }
  if (normalizeStatus(startupEvidence.status) !== 'passed') {
    throw new Error(`Desktop startup evidence must preserve passed status: ${startupEvidencePath}`);
  }

  const desktopStartupReadinessSummary = summarizeDesktopStartupReadiness(
    startupEvidence.readinessEvidence,
  );

  return {
    desktopInstallerSmoke: {
      reportRelativePath: toRelativePath(releaseAssetsDir, installerReportPath),
      manifestRelativePath: toRelativePath(
        releaseAssetsDir,
        path.join(
          releaseAssetsDir,
          'desktop',
          descriptor.platform,
          descriptor.arch,
          RELEASE_ASSET_MANIFEST_FILE_NAME,
        ),
      ),
      ...installerReport,
    },
    desktopStartupSmoke: {
      reportRelativePath: toRelativePath(releaseAssetsDir, startupReportPath),
      manifestRelativePath: toRelativePath(
        releaseAssetsDir,
        path.join(
          releaseAssetsDir,
          'desktop',
          descriptor.platform,
          descriptor.arch,
          RELEASE_ASSET_MANIFEST_FILE_NAME,
        ),
      ),
      ...startupReport,
    },
    desktopStartupEvidence: {
      capturedEvidenceRelativePath: toRelativePath(releaseAssetsDir, startupEvidencePath),
      ...startupEvidence,
    },
    ...(desktopStartupReadinessSummary
      ? { desktopStartupReadinessSummary }
      : {}),
  };
}

function normalizeReleaseSmokeMetadata({
  releaseAssetsDir,
  descriptor,
} = {}) {
  const reportPath = resolveReleaseSmokeReportPath({
    releaseAssetsDir,
    family: descriptor.family,
    platform: descriptor.platform,
    arch: descriptor.arch,
    accelerator: descriptor.accelerator,
  });
  const releaseSmoke = readReleaseSmokeReport(reportPath);
  const normalizedStatus = normalizeStatus(releaseSmoke.status);
  if (normalizedStatus !== 'passed' && normalizedStatus !== 'skipped') {
    throw new Error(`Release smoke must pass or skip before finalize: ${reportPath}`);
  }

  return {
    releaseSmoke: {
      reportRelativePath: toRelativePath(releaseAssetsDir, reportPath),
      manifestRelativePath: toRelativePath(
        releaseAssetsDir,
        descriptor.family === 'web'
          ? path.join(
            releaseAssetsDir,
            'web',
            RELEASE_ASSET_MANIFEST_FILE_NAME,
          )
          : path.join(
            releaseAssetsDir,
            descriptor.family,
            descriptor.platform,
            descriptor.arch,
            ...(descriptor.family === 'container' || descriptor.family === 'kubernetes'
              ? [descriptor.accelerator || 'cpu']
              : []),
            RELEASE_ASSET_MANIFEST_FILE_NAME,
          ),
      ),
      ...releaseSmoke,
    },
  };
}

function buildManifestAssetEntry({
  releaseAssetsDir,
  manifestFile,
  descriptor,
} = {}) {
  const entry = {
    file: descriptor.archiveRelativePath || manifestFile,
    manifestFile,
    ...descriptor,
  };

  if (descriptor.family === 'desktop') {
    return {
      ...entry,
      ...normalizeDesktopSmokeMetadata({
        releaseAssetsDir,
        descriptor,
      }),
    };
  }

  if (
    descriptor.family === 'server'
    || descriptor.family === 'container'
    || descriptor.family === 'kubernetes'
    || descriptor.family === 'web'
  ) {
    return {
      ...entry,
      ...normalizeReleaseSmokeMetadata({
        releaseAssetsDir,
        descriptor,
      }),
    };
  }

  return entry;
}

export function finalizeReleaseAssets(options = {}) {
  const rootDir = process.cwd();
  const profileId = options.profile ?? DEFAULT_RELEASE_PROFILE_ID;
  const releaseTag = options['release-tag'] ?? 'release-local';
  const repository = options.repository ?? '';
  const releaseAssetsDir = path.resolve(rootDir, options['release-assets-dir'] ?? 'release-assets');
  const profile = resolveReleaseProfile(profileId);

  fs.mkdirSync(releaseAssetsDir, { recursive: true });

  const familyManifests = walkFiles(releaseAssetsDir)
    .filter((filePath) => path.basename(filePath) === RELEASE_ASSET_MANIFEST_FILE_NAME)
    .map((filePath) => ({
      descriptor: readJsonFile(filePath),
      manifestFile: toRelativePath(releaseAssetsDir, filePath),
    }));
  if (familyManifests.length === 0) {
    throw new Error(`No release asset manifests found under ${releaseAssetsDir}`);
  }

  const manifestPath = path.join(releaseAssetsDir, profile.release.manifestFileName);
  const checksumsPath = path.join(releaseAssetsDir, profile.release.globalChecksumsFileName);
  const manifest = {
    profileId,
    releaseTag,
    repository,
    productName: profile.productName,
    releaseName: `${profile.productName} ${releaseTag}`,
    releaseControl: resolveReleaseControl({
      releaseKind: options['release-kind'],
      rolloutStage: options['rollout-stage'],
      monitoringWindowMinutes: options['monitoring-window-minutes'],
      rollbackRunbookRef: options['rollback-runbook-ref'],
      rollbackCommand: options['rollback-command'],
    }),
    generatedAt: new Date().toISOString(),
    checksumFileName: profile.release.globalChecksumsFileName,
    attestationEnabled: profile.release.enableArtifactAttestations,
    verification: repository
      ? {
        checksumCommand: `sha256sum -c ${profile.release.globalChecksumsFileName}`,
        attestationCommand: `gh attestation verify <asset-path> -R ${repository}`,
      }
      : undefined,
    assets: familyManifests.map((entry) => buildManifestAssetEntry({
      releaseAssetsDir,
      manifestFile: entry.manifestFile,
      descriptor: entry.descriptor,
    })),
  };
  const previewEvidence = summarizeStudioPreviewEvidenceArchive({
    releaseAssetsDir,
  });
  if (previewEvidence) {
    manifest.previewEvidence = {
      archiveRelativePath: previewEvidence.archiveRelativePath,
      entryCount: previewEvidence.entryCount,
      channels: previewEvidence.channels,
      projectIds: previewEvidence.projectIds,
      latestLaunchedAt: previewEvidence.latestLaunchedAt,
    };
  }
  const buildEvidence = summarizeStudioBuildEvidenceArchive({
    releaseAssetsDir,
  });
  if (buildEvidence) {
    manifest.buildEvidence = {
      archiveRelativePath: buildEvidence.archiveRelativePath,
      entryCount: buildEvidence.entryCount,
      targets: buildEvidence.targets,
      outputKinds: buildEvidence.outputKinds,
      projectIds: buildEvidence.projectIds,
      latestLaunchedAt: buildEvidence.latestLaunchedAt,
    };
  }
  const simulatorEvidence = summarizeStudioSimulatorEvidenceArchive({
    releaseAssetsDir,
  });
  if (simulatorEvidence) {
    manifest.simulatorEvidence = {
      archiveRelativePath: simulatorEvidence.archiveRelativePath,
      entryCount: simulatorEvidence.entryCount,
      channels: simulatorEvidence.channels,
      runtimes: simulatorEvidence.runtimes,
      projectIds: simulatorEvidence.projectIds,
      latestLaunchedAt: simulatorEvidence.latestLaunchedAt,
    };
  }
  const testEvidence = summarizeStudioTestEvidenceArchive({
    releaseAssetsDir,
  });
  if (testEvidence) {
    manifest.testEvidence = {
      archiveRelativePath: testEvidence.archiveRelativePath,
      entryCount: testEvidence.entryCount,
      commands: testEvidence.commands,
      projectIds: testEvidence.projectIds,
      latestLaunchedAt: testEvidence.latestLaunchedAt,
    };
  }
  const codingServerOpenApiEvidence = createCodingServerOpenApiEvidence({
    releaseAssetsDir,
    assets: manifest.assets,
  });
  if (codingServerOpenApiEvidence) {
    manifest.codingServerOpenApiEvidence = codingServerOpenApiEvidence;
  }
  const qualityEvidence = createReleaseQualityEvidence({
    rootDir,
    releaseAssetsDir,
    qualityExecutionReportPath: options['quality-execution-report-path'],
  });
  manifest.qualityEvidence = enrichQualityEvidenceSummary(
    qualityEvidence.summary,
    {
      releaseReadinessSignals: collectDesktopStartupReadinessSignals(manifest.assets),
    },
  );
  manifest.stopShipSignals = collectReleaseStopShipSignals({
    qualityEvidence: manifest.qualityEvidence,
    assets: manifest.assets,
  });
  manifest.promotionReadiness = buildPromotionReadinessSummary({
    releaseControl: manifest.releaseControl,
    stopShipSignals: manifest.stopShipSignals,
  });
  assertClearStopShipEvidence({
    releaseControl: manifest.releaseControl,
    qualityEvidence: manifest.qualityEvidence,
    assets: manifest.assets,
    errorPrefix: 'Formal or general-availability release finalization requires clear stop-ship evidence',
  });

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const checksumTargets = walkFiles(releaseAssetsDir)
    .filter((filePath) => path.resolve(filePath) !== path.resolve(checksumsPath));
  const checksumLines = checksumTargets.map((filePath) => {
    const digest = computeSha256(filePath);
    const relativePath = toRelativePath(releaseAssetsDir, filePath);
    return `${digest}  ${relativePath}`;
  });
  fs.writeFileSync(checksumsPath, `${checksumLines.join('\n')}\n`);

  return {
    releaseAssetsDir,
    manifestPath,
    checksumsPath,
    assetCount: manifest.assets.length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = finalizeReleaseAssets(parseOptions(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
