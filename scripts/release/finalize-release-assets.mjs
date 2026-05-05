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
  DESKTOP_INSTALLER_TRUST_REPORT_FILENAME,
} from './verify-desktop-installer-trust.mjs';
import {
  normalizeDesktopInstallerSignatureEvidence,
  normalizeDesktopInstallerTrustSummary,
} from './desktop-installer-trust-evidence.mjs';
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

function assertReleaseTopLevelFileName(fileName, label) {
  if (
    !fileName
    || fileName === '.'
    || fileName === '..'
    || fileName.includes('\0')
    || fileName.includes(':')
    || fileName.includes('/')
    || fileName.includes('\\')
    || path.posix.isAbsolute(fileName)
    || path.win32.isAbsolute(fileName)
    || path.posix.basename(fileName) !== fileName
    || path.win32.basename(fileName) !== fileName
  ) {
    throw new Error(`Invalid ${label}: ${fileName || 'missing'}`);
  }
}

function removeStaleReleaseMetadata({
  releaseAssetsDir,
  profile,
}) {
  for (const fileName of [
    profile.release.manifestFileName,
    profile.release.manifestChecksumFileName,
    profile.release.attestationEvidenceFileName,
    profile.release.globalChecksumsFileName,
  ].filter(Boolean)) {
    assertReleaseTopLevelFileName(fileName, 'release metadata file name');
    fs.rmSync(path.join(releaseAssetsDir, fileName), { force: true });
  }
}

function writeFileChecksumSidecar({
  sourcePath,
  sourceFileName,
  sidecarPath,
}) {
  fs.writeFileSync(
    sidecarPath,
    `${computeSha256(sourcePath)}  ${sourceFileName}\n`,
    'utf8',
  );
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

function normalizeManifestArtifactPath(relativePath) {
  return String(relativePath ?? '').trim().replaceAll('\\', '/');
}

function assertSafeManifestArtifactPath(relativePath) {
  const normalizedRelativePath = normalizeManifestArtifactPath(relativePath);
  if (!normalizedRelativePath) {
    throw new Error('Release artifact entry is missing relativePath.');
  }
  if (
    path.posix.isAbsolute(normalizedRelativePath)
    || path.win32.isAbsolute(normalizedRelativePath)
    || normalizedRelativePath.split('/').includes('..')
  ) {
    throw new Error(`Release artifact entry has unsafe relativePath: ${normalizedRelativePath}`);
  }

  return normalizedRelativePath;
}

function inferArtifactKind(relativePath) {
  const normalizedRelativePath = String(relativePath ?? '').trim().toLowerCase();
  if (normalizedRelativePath.endsWith('.json') || normalizedRelativePath.endsWith('.yaml') || normalizedRelativePath.endsWith('.yml')) {
    return 'metadata';
  }
  if (normalizedRelativePath.endsWith('.exe') || normalizedRelativePath.endsWith('.msi') || normalizedRelativePath.endsWith('.dmg')) {
    return 'installer';
  }
  if (normalizedRelativePath.endsWith('.deb') || normalizedRelativePath.endsWith('.rpm') || normalizedRelativePath.endsWith('.appimage')) {
    return 'package';
  }

  return 'archive';
}

function resolveArtifactPlatform(descriptor) {
  if (descriptor.family === 'web') {
    return 'web';
  }

  return String(descriptor.platform ?? '').trim();
}

function resolveArtifactArch(descriptor) {
  if (descriptor.family === 'web') {
    return 'any';
  }

  return String(descriptor.arch ?? '').trim();
}

function buildPublishArtifactEntries({
  releaseAssetsDir,
  familyManifests,
} = {}) {
  const artifactEntries = [];
  const seenRelativePaths = new Set();

  for (const { descriptor } of familyManifests) {
    for (const artifact of descriptor.artifacts ?? []) {
      const relativePath = assertSafeManifestArtifactPath(artifact.relativePath);
      if (seenRelativePaths.has(relativePath)) {
        throw new Error(`Duplicate release artifact entry: ${relativePath}`);
      }

      const artifactPath = path.join(releaseAssetsDir, relativePath);
      if (!fs.existsSync(artifactPath)) {
        throw new Error(`Missing release artifact declared by ${descriptor.family} manifest: ${relativePath}`);
      }

      const artifactStat = fs.statSync(artifactPath);
      if (!artifactStat.isFile()) {
        throw new Error(`Release artifact declared by ${descriptor.family} manifest is not a file: ${relativePath}`);
      }

      seenRelativePaths.add(relativePath);
      const artifactEntry = {
        family: String(descriptor.family ?? '').trim(),
        platform: resolveArtifactPlatform(descriptor),
        arch: resolveArtifactArch(descriptor),
        target: String(descriptor.target ?? '').trim(),
        accelerator: String(descriptor.accelerator ?? '').trim(),
        kind: String(artifact.kind ?? '').trim() || inferArtifactKind(relativePath),
        relativePath,
        sha256: computeSha256(artifactPath),
        size: artifactStat.size,
      };
      const bundle = String(artifact.bundle ?? '').trim();
      const installerFormat = String(artifact.installerFormat ?? '').trim();
      const artifactTarget = String(artifact.target ?? '').trim();
      if (bundle) {
        artifactEntry.bundle = bundle;
      }
      if (installerFormat) {
        artifactEntry.installerFormat = installerFormat;
      }
      if (artifactTarget) {
        artifactEntry.target = artifactTarget;
      }
      const signatureEvidence = normalizeDesktopInstallerSignatureEvidence(
        artifact.signatureEvidence,
      );
      if (signatureEvidence) {
        artifactEntry.signatureEvidence = signatureEvidence;
      }

      artifactEntries.push(artifactEntry);
    }
  }

  return artifactEntries.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function buildRequiredReleaseCoverage(profile) {
  const requiredTargets = ['web/web/any'];

  for (const entry of profile.desktop?.matrix ?? []) {
    for (const bundle of entry.bundles ?? []) {
      requiredTargets.push(`desktop/${entry.platform}/${entry.arch}/${bundle}`);
    }
  }

  for (const entry of profile.server?.matrix ?? []) {
    requiredTargets.push(`server/${entry.platform}/${entry.arch}`);
  }

  for (const entry of profile.container?.matrix ?? []) {
    requiredTargets.push(`container/${entry.platform}/${entry.arch}/${entry.accelerator}`);
  }

  for (const entry of profile.kubernetes?.matrix ?? []) {
    requiredTargets.push(`kubernetes/${entry.platform}/${entry.arch}/${entry.accelerator}`);
  }

  return requiredTargets.sort((left, right) => left.localeCompare(right));
}

function desktopArtifactSatisfiesBundle(artifact, bundle) {
  const explicitBundle = String(artifact.bundle ?? '').trim().toLowerCase();
  if (explicitBundle) {
    return explicitBundle === bundle && String(artifact.kind ?? '').trim() === 'installer';
  }

  const relativePath = String(artifact.relativePath ?? '').trim().toLowerCase();
  if (bundle === 'nsis') {
    return relativePath.endsWith('.exe');
  }
  if (bundle === 'msi') {
    return relativePath.endsWith('.msi');
  }
  if (bundle === 'deb') {
    return relativePath.endsWith('.deb');
  }
  if (bundle === 'rpm') {
    return relativePath.endsWith('.rpm');
  }
  if (bundle === 'appimage') {
    return relativePath.endsWith('.appimage');
  }
  if (bundle === 'app') {
    return relativePath.endsWith('.app.zip') || relativePath.endsWith('.app.tar.gz');
  }
  if (bundle === 'dmg') {
    return relativePath.endsWith('.dmg');
  }

  return false;
}

function artifactSatisfiesCoverageTarget(artifact, target) {
  const [family, platform, arch, qualifier] = target.split('/');
  if (
    artifact.family !== family
    || artifact.platform !== platform
    || artifact.arch !== arch
  ) {
    return false;
  }

  if (family === 'desktop') {
    return desktopArtifactSatisfiesBundle(artifact, qualifier);
  }
  if (family === 'container' || family === 'kubernetes') {
    return String(artifact.accelerator ?? '').trim() === qualifier;
  }

  return true;
}

function buildReleaseCoverage({
  profile,
  artifacts,
  allowPartialRelease = false,
} = {}) {
  const requiredTargets = buildRequiredReleaseCoverage(profile);
  const presentTargets = requiredTargets
    .filter((target) => artifacts.some((artifact) => artifactSatisfiesCoverageTarget(artifact, target)))
    .sort((left, right) => left.localeCompare(right));
  const missingTargets = requiredTargets
    .filter((target) => !presentTargets.includes(target))
    .sort((left, right) => left.localeCompare(right));

  return {
    status: missingTargets.length === 0 ? 'complete' : 'partial',
    allowPartialRelease: Boolean(allowPartialRelease),
    requiredTargets,
    presentTargets,
    missingTargets,
  };
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
  const installerTrustReportPath = path.join(
    releaseAssetsDir,
    'desktop',
    descriptor.platform,
    descriptor.arch,
    DESKTOP_INSTALLER_TRUST_REPORT_FILENAME,
  );

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
  const installerTrustReport = fs.existsSync(installerTrustReportPath)
    ? ensureExistingJson(
      installerTrustReportPath,
      DESKTOP_INSTALLER_TRUST_REPORT_FILENAME,
    )
    : null;
  const desktopInstallerTrust = installerTrustReport
    ? normalizeDesktopInstallerTrustSummary({
      reportRelativePath: toRelativePath(releaseAssetsDir, installerTrustReportPath),
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
      ...installerTrustReport,
    })
    : null;

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
    ...(desktopInstallerTrust
      ? { desktopInstallerTrust }
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
  const allowPartialRelease = options['allow-partial-release'] === true
    || options['allow-partial-release'] === 'true'
    || options.allowPartialRelease === true;

  fs.mkdirSync(releaseAssetsDir, { recursive: true });
  removeStaleReleaseMetadata({
    releaseAssetsDir,
    profile,
  });

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
  const artifacts = buildPublishArtifactEntries({
    releaseAssetsDir,
    familyManifests,
  });
  const releaseCoverage = buildReleaseCoverage({
    profile,
    artifacts,
    allowPartialRelease,
  });
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
    attestationEvidenceFileName: profile.release.attestationEvidenceFileName,
    attestationPredicateType: profile.release.attestationPredicateType,
    releaseCoverage,
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
    artifacts,
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
    artifacts: manifest.artifacts,
  });
  manifest.promotionReadiness = buildPromotionReadinessSummary({
    releaseControl: manifest.releaseControl,
    stopShipSignals: manifest.stopShipSignals,
  });
  assertClearStopShipEvidence({
    releaseControl: manifest.releaseControl,
    qualityEvidence: manifest.qualityEvidence,
    assets: manifest.assets,
    artifacts: manifest.artifacts,
    errorPrefix: 'Formal or general-availability release finalization requires clear stop-ship evidence',
  });

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileChecksumSidecar({
    sourcePath: manifestPath,
    sourceFileName: profile.release.manifestFileName,
    sidecarPath: path.join(releaseAssetsDir, profile.release.manifestChecksumFileName),
  });

  const checksumLines = manifest.artifacts.map((artifact) => `${artifact.sha256}  ${artifact.relativePath}`);
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
