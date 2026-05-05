#!/usr/bin/env node

import {
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { assertReleaseReadiness } from './assert-release-readiness.mjs';
import { writeDesktopInstallerSmokeReport } from './desktop-installer-smoke-contract.mjs';
import {
  writeDesktopStartupEvidence,
  writeDesktopStartupSmokeReport,
} from './desktop-startup-smoke-contract.mjs';
import {
  resolveDesktopInstallerSignatureScheme,
} from './desktop-installer-trust-evidence.mjs';
import {
  DESKTOP_INSTALLER_TRUST_REPORT_FILENAME,
} from './verify-desktop-installer-trust.mjs';
import { finalizeReleaseAssets } from './finalize-release-assets.mjs';
import {
  DEFAULT_RELEASE_PROFILE_ID,
  RELEASE_ASSET_MANIFEST_FILE_NAME,
  resolveReleaseProfile,
} from './release-profiles.mjs';
import { createReleasePlan } from './resolve-release-plan.mjs';
import { writeReleaseSmokeReport } from './release-smoke-contract.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

export const DEFAULT_RELEASE_ASSETS_DIR = path.join(rootDir, 'artifacts', 'release-readiness-fixture');
export const DEFAULT_RELEASE_TAG = 'release-fixture';
export const DEFAULT_REPOSITORY = 'Sdkwork-Cloud/sdkwork-birdcoder';

const DEFAULT_GENERATED_AT = '2026-04-12T00:00:00.000Z';
const DEFAULT_VERIFIED_AT = '2026-04-12T00:00:01.000Z';
const RELEASE_READINESS_FIXTURE_DIR_NAMES = new Set([
  'release-readiness-fixture',
  'release-candidate-dry-run',
]);

function normalizeComparablePath(value) {
  return path.resolve(value).replace(/[\\/]+$/, '').toLowerCase();
}

function isPathInside(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);

  return Boolean(relativePath)
    && !relativePath.startsWith('..')
    && !path.isAbsolute(relativePath);
}

export function assertSafeReleaseReadinessFixtureDir(releaseAssetsDir) {
  const normalizedReleaseAssetsDir = path.resolve(releaseAssetsDir);
  const comparableReleaseAssetsDir = normalizeComparablePath(normalizedReleaseAssetsDir);
  const artifactsDir = path.join(rootDir, 'artifacts');
  const dangerousWorkspaceDirs = [
    rootDir,
    artifactsDir,
    path.join(artifactsDir, 'release'),
    path.join(rootDir, 'release-assets'),
  ].map(normalizeComparablePath);

  if (dangerousWorkspaceDirs.includes(comparableReleaseAssetsDir)) {
    throw new Error(
      `Refusing to clean unsafe release readiness fixture directory: ${normalizedReleaseAssetsDir}`,
    );
  }

  const workspaceRelativePath = path.relative(rootDir, normalizedReleaseAssetsDir);
  const isInsideWorkspace = workspaceRelativePath
    && !workspaceRelativePath.startsWith('..')
    && !path.isAbsolute(workspaceRelativePath);
  const defaultFixtureDir = path.resolve(DEFAULT_RELEASE_ASSETS_DIR);
  if (
    isInsideWorkspace
    && normalizeComparablePath(defaultFixtureDir) !== comparableReleaseAssetsDir
    && !isPathInside(defaultFixtureDir, normalizedReleaseAssetsDir)
    && !RELEASE_READINESS_FIXTURE_DIR_NAMES.has(path.basename(normalizedReleaseAssetsDir))
  ) {
    throw new Error(
      `Refusing to use workspace directory that is not an explicit release readiness fixture directory: ${normalizedReleaseAssetsDir}`,
    );
  }

  const systemTemporaryDir = path.resolve(tmpdir());
  if (
    !isInsideWorkspace
    && !isPathInside(systemTemporaryDir, normalizedReleaseAssetsDir)
  ) {
    throw new Error(
      `Refusing to use release readiness fixture directory outside the workspace or system temporary directory: ${normalizedReleaseAssetsDir}`,
    );
  }
}

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function writeFile(targetPath, value = '') {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, value);
}

function writeJson(targetPath, value) {
  writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeRelativePath(targetPath) {
  return targetPath.split(path.sep).join('/');
}

function artifactSize(releaseAssetsDir, relativePath) {
  return statSync(path.join(releaseAssetsDir, relativePath)).size;
}

function writeArtifact(releaseAssetsDir, relativePath, value = '') {
  const normalizedRelativePath = String(relativePath).replaceAll('\\', '/');
  writeFile(
    path.join(releaseAssetsDir, normalizedRelativePath),
    value || `release fixture artifact: ${normalizedRelativePath}\n`,
  );

  return normalizedRelativePath;
}

function writeReleaseAssetManifest({
  releaseAssetsDir,
  profile,
  releaseTag,
  family,
  platform = '',
  arch = '',
  target = '',
  accelerator = '',
  artifacts,
}) {
  const artifactEntries = artifacts.map((artifact) => (
    typeof artifact === 'string'
      ? { relativePath: artifact }
      : { ...artifact }
  ));
  const manifestDir = family === 'web'
    ? path.join(releaseAssetsDir, 'web')
    : family === 'container' || family === 'kubernetes'
      ? path.join(releaseAssetsDir, family, platform, arch, accelerator)
      : path.join(releaseAssetsDir, family, platform, arch);
  const archiveRelativePath = artifactEntries.find((entry) => (
    String(entry.relativePath ?? '').endsWith('.tar.gz')
  ))?.relativePath ?? artifactEntries[0]?.relativePath;
  const manifestPath = path.join(manifestDir, RELEASE_ASSET_MANIFEST_FILE_NAME);

  writeJson(manifestPath, {
    family,
    profileId: profile.id,
    productName: profile.productName,
    releaseTag,
    platform,
    arch,
    target,
    accelerator,
    archiveFormat: 'tar.gz',
    archiveRelativePath,
    artifacts: artifactEntries.map((artifact) => ({
      ...artifact,
      size: artifactSize(releaseAssetsDir, artifact.relativePath),
    })),
    createdAt: DEFAULT_GENERATED_AT,
  });

  return manifestPath;
}

function createPassedSignatureEvidence({ platform, bundle }) {
  const scheme = resolveDesktopInstallerSignatureScheme({ platform, bundle });
  if (scheme === 'windows-authenticode') {
    return {
      status: 'passed',
      required: true,
      scheme,
      verifiedAt: DEFAULT_VERIFIED_AT,
      subject: 'CN=SDKWork BirdCoder',
      issuer: 'CN=SDKWork Code Signing CA',
      timestamped: true,
      notarized: false,
      stapled: false,
      packageMetadataVerified: true,
    };
  }
  if (scheme === 'macos-codesign-notarization') {
    return {
      status: 'passed',
      required: true,
      scheme,
      verifiedAt: DEFAULT_VERIFIED_AT,
      subject: 'Developer ID Application: SDKWork BirdCoder',
      issuer: 'Developer ID Certification Authority',
      timestamped: false,
      notarized: true,
      stapled: true,
      packageMetadataVerified: true,
    };
  }

  return {
    status: 'passed',
    required: true,
    scheme,
    verifiedAt: DEFAULT_VERIFIED_AT,
    subject: '',
    issuer: '',
    timestamped: false,
    notarized: false,
    stapled: false,
    packageMetadataVerified: true,
  };
}

function desktopBundleFileName(entry, bundle) {
  const baseName = `SDKWork-BirdCoder-${entry.platform}-${entry.arch}`;
  if (bundle === 'nsis') {
    return `${baseName}-setup.exe`;
  }
  if (bundle === 'msi') {
    return `${baseName}.msi`;
  }
  if (bundle === 'deb') {
    return `${baseName}.deb`;
  }
  if (bundle === 'rpm') {
    return `${baseName}.rpm`;
  }
  if (bundle === 'appimage') {
    return `${baseName}.AppImage`;
  }
  if (bundle === 'app') {
    return `${baseName}.app.tar.gz`;
  }
  if (bundle === 'dmg') {
    return `${baseName}.dmg`;
  }

  throw new Error(`Unsupported desktop bundle fixture: ${bundle}`);
}

function writeDesktopTrustReport({
  releaseAssetsDir,
  entry,
  manifestPath,
  artifacts,
}) {
  const installerArtifacts = artifacts
    .filter((artifact) => artifact.kind === 'installer')
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const reportPath = path.join(
    releaseAssetsDir,
    'desktop',
    entry.platform,
    entry.arch,
    DESKTOP_INSTALLER_TRUST_REPORT_FILENAME,
  );

  writeJson(reportPath, {
    status: 'passed',
    platform: entry.platform,
    arch: entry.arch,
    target: entry.target,
    manifestPath: path.resolve(manifestPath),
    verifiedAt: DEFAULT_VERIFIED_AT,
    installerCount: installerArtifacts.length,
    installers: installerArtifacts.map((artifact) => ({
      relativePath: artifact.relativePath,
      bundle: artifact.bundle,
      installerFormat: artifact.installerFormat,
      target: artifact.target,
      signatureEvidence: artifact.signatureEvidence,
    })),
  });

  return reportPath;
}

function writeDesktopTarget({
  releaseAssetsDir,
  profile,
  releaseTag,
  entry,
}) {
  const artifacts = entry.bundles.map((bundle) => {
    const relativePath = writeArtifact(
      releaseAssetsDir,
      `desktop/${entry.platform}/${entry.arch}/${desktopBundleFileName(entry, bundle)}`,
      `desktop ${entry.platform} ${entry.arch} ${bundle} fixture\n`,
    );

    return {
      relativePath,
      kind: 'installer',
      bundle,
      installerFormat: bundle,
      target: entry.target,
      signatureEvidence: createPassedSignatureEvidence({
        platform: entry.platform,
        bundle,
      }),
    };
  });
  const manifestPath = writeReleaseAssetManifest({
    releaseAssetsDir,
    profile,
    releaseTag,
    family: 'desktop',
    platform: entry.platform,
    arch: entry.arch,
    target: entry.target,
    artifacts,
  });

  writeDesktopInstallerSmokeReport({
    releaseAssetsDir,
    platform: entry.platform,
    arch: entry.arch,
    target: entry.target,
    manifestPath,
    installableArtifactRelativePaths: artifacts.map((artifact) => artifact.relativePath),
    requiredCompanionArtifactRelativePaths: [],
    installPlanSummaries: artifacts.map((artifact) => ({
      relativePath: artifact.relativePath,
      format: artifact.bundle,
      bundle: artifact.bundle,
      target: entry.target,
      platform: entry.platform,
      stepCount: 1,
      signatureEvidence: artifact.signatureEvidence,
    })),
    installReadyLayout: {
      mode: 'native-installers',
      ready: true,
    },
    verifiedAt: DEFAULT_VERIFIED_AT,
  });
  const readinessEvidence = {
    ready: true,
    shellMounted: true,
    workspaceBootstrap: {
      defaultWorkspaceReady: true,
      defaultProjectReady: true,
      recoverySnapshotReady: true,
    },
    localProjectRecovery: {
      autoRemountSupported: true,
      recoveringStateVisible: true,
      failedStateVisible: true,
      retrySupported: true,
      reimportSupported: true,
    },
  };
  const startupEvidence = writeDesktopStartupEvidence({
    releaseAssetsDir,
    platform: entry.platform,
    arch: entry.arch,
    target: entry.target,
    manifestPath,
    artifactRelativePaths: artifacts.map((artifact) => artifact.relativePath),
    readinessEvidence,
    capturedAt: DEFAULT_VERIFIED_AT,
  });
  writeDesktopStartupSmokeReport({
    releaseAssetsDir,
    platform: entry.platform,
    arch: entry.arch,
    target: entry.target,
    manifestPath,
    artifactRelativePaths: artifacts.map((artifact) => artifact.relativePath),
    capturedEvidenceRelativePath: normalizeRelativePath(
      path.relative(releaseAssetsDir, startupEvidence.capturedEvidencePath),
    ),
    checks: [
      {
        id: 'shell-mounted',
        status: 'passed',
        detail: 'desktop shell mounted successfully',
      },
      {
        id: 'local-project-recovery',
        status: 'passed',
        detail: 'local project recovery is ready',
      },
    ],
    verifiedAt: DEFAULT_VERIFIED_AT,
  });
  writeDesktopTrustReport({
    releaseAssetsDir,
    entry,
    manifestPath,
    artifacts,
  });
}

function writeWebTarget({
  releaseAssetsDir,
  profile,
  releaseTag,
}) {
  const artifactRelativePath = writeArtifact(
    releaseAssetsDir,
    `web/sdkwork-birdcoder-web-${releaseTag}.tar.gz`,
    [
      'web/dist/index.html',
      'web/dist/assets/index.js',
      'docs/dist/index.html',
      '',
    ].join('\n'),
  );
  const manifestPath = writeReleaseAssetManifest({
    releaseAssetsDir,
    profile,
    releaseTag,
    family: 'web',
    platform: '',
    arch: '',
    target: '',
    artifacts: [artifactRelativePath],
  });
  writeReleaseSmokeReport({
    releaseAssetsDir,
    family: 'web',
    platform: 'web',
    arch: 'any',
    smokeKind: 'bundle-contract',
    status: 'passed',
    manifestPath,
    artifactRelativePaths: [artifactRelativePath],
    checks: [
      {
        id: 'web-bundle-present',
        status: 'passed',
        detail: 'web release archive is present',
      },
    ],
    verifiedAt: DEFAULT_VERIFIED_AT,
  });
}

function writeServerTarget({
  releaseAssetsDir,
  profile,
  releaseTag,
  entry,
}) {
  const artifactRelativePath = writeArtifact(
    releaseAssetsDir,
    `server/${entry.platform}/${entry.arch}/sdkwork-birdcoder-server-${releaseTag}-${entry.platform}-${entry.arch}.tar.gz`,
  );
  const openApiRelativePath = `server/${entry.platform}/${entry.arch}/openapi/coding-server-v1.json`;
  writeArtifact(
    releaseAssetsDir,
    openApiRelativePath,
    `${JSON.stringify({
      openapi: '3.1.0',
      info: {
        title: 'SDKWork BirdCoder Coding Server API',
        version: 'v1',
      },
    }, null, 2)}\n`,
  );
  const manifestPath = writeReleaseAssetManifest({
    releaseAssetsDir,
    profile,
    releaseTag,
    family: 'server',
    platform: entry.platform,
    arch: entry.arch,
    target: entry.target,
    artifacts: [artifactRelativePath, openApiRelativePath],
  });
  writeReleaseSmokeReport({
    releaseAssetsDir,
    family: 'server',
    platform: entry.platform,
    arch: entry.arch,
    target: entry.target,
    smokeKind: 'bundle-contract',
    status: 'passed',
    manifestPath,
    artifactRelativePaths: [artifactRelativePath, openApiRelativePath],
    launcherRelativePath: `server/${entry.platform}/${entry.arch}/sdkwork-birdcoder-server`,
    runtimeBaseUrl: 'http://127.0.0.1:18080',
    checks: [
      {
        id: 'server-bundle-present',
        status: 'passed',
        detail: 'server release archive is present',
      },
      {
        id: 'openapi-snapshot-present',
        status: 'passed',
        detail: 'coding server OpenAPI snapshot is packaged',
      },
    ],
    verifiedAt: DEFAULT_VERIFIED_AT,
  });
}

function writeDeploymentTarget({
  releaseAssetsDir,
  profile,
  releaseTag,
  family,
  entry,
}) {
  const artifactRelativePath = writeArtifact(
    releaseAssetsDir,
    `${family}/${entry.platform}/${entry.arch}/${entry.accelerator}/sdkwork-birdcoder-${family}-${releaseTag}-${entry.platform}-${entry.arch}-${entry.accelerator}.tar.gz`,
    family === 'container'
      ? 'services:\n  birdcoder-server:\n    image: sdkwork-birdcoder-server:fixture\n'
      : 'apiVersion: v2\nname: sdkwork-birdcoder\nversion: 0.1.0\n',
  );
  const manifestPath = writeReleaseAssetManifest({
    releaseAssetsDir,
    profile,
    releaseTag,
    family,
    platform: entry.platform,
    arch: entry.arch,
    target: entry.target,
    accelerator: entry.accelerator,
    artifacts: [artifactRelativePath],
  });
  writeReleaseSmokeReport({
    releaseAssetsDir,
    family,
    platform: entry.platform,
    arch: entry.arch,
    target: entry.target,
    accelerator: entry.accelerator,
    smokeKind: family === 'container' ? 'compose-contract' : 'chart-contract',
    status: 'passed',
    manifestPath,
    artifactRelativePaths: [artifactRelativePath],
    launcherRelativePath: family === 'container' ? 'docker-compose.yml' : 'Chart.yaml',
    runtimeBaseUrl: family === 'container' ? 'http://127.0.0.1:18080' : '',
    checks: [
      {
        id: `${family}-bundle-present`,
        status: 'passed',
        detail: `${family} release archive is present`,
      },
    ],
    verifiedAt: DEFAULT_VERIFIED_AT,
  });
}

function countPlanRequiredTargets(plan) {
  return 1
    + (plan.desktopMatrix ?? []).reduce(
      (total, entry) => total + (entry.bundles?.length ?? 0),
      0,
    )
    + (plan.serverMatrix?.length ?? 0)
    + (plan.containerMatrix?.length ?? 0)
    + (plan.kubernetesMatrix?.length ?? 0);
}

function writeCompleteReleaseFixture({
  releaseAssetsDir,
  profile,
  releaseTag,
}) {
  writeWebTarget({
    releaseAssetsDir,
    profile,
    releaseTag,
  });

  for (const entry of profile.desktop.matrix) {
    writeDesktopTarget({
      releaseAssetsDir,
      profile,
      releaseTag,
      entry,
    });
  }

  for (const entry of profile.server.matrix) {
    writeServerTarget({
      releaseAssetsDir,
      profile,
      releaseTag,
      entry,
    });
  }

  for (const entry of profile.container.matrix) {
    writeDeploymentTarget({
      releaseAssetsDir,
      profile,
      releaseTag,
      family: 'container',
      entry,
    });
  }

  for (const entry of profile.kubernetes.matrix) {
    writeDeploymentTarget({
      releaseAssetsDir,
      profile,
      releaseTag,
      family: 'kubernetes',
      entry,
    });
  }
}

function writeAttestationEvidenceFixture({
  releaseAssetsDir,
  profile,
  manifest,
  repository,
  releaseTag,
}) {
  const sourceRef = `refs/tags/${releaseTag}`;
  const evidencePath = path.join(releaseAssetsDir, profile.release.attestationEvidenceFileName);
  writeJson(
    evidencePath,
    {
      schemaVersion: 1,
      repository,
      releaseTag,
      sourceRef,
      generatedAt: DEFAULT_VERIFIED_AT,
      predicateType: profile.release.attestationPredicateType,
      signerWorkflow: profile.release.attestationSignerWorkflowPath,
      artifacts: manifest.artifacts.map((artifact) => ({
        relativePath: artifact.relativePath,
        sha256: artifact.sha256,
        repository,
        releaseTag,
        sourceRef,
        predicateType: profile.release.attestationPredicateType,
        signerWorkflow: profile.release.attestationSignerWorkflowPath,
        verified: true,
        verifiedAt: DEFAULT_VERIFIED_AT,
        verificationCommand: `gh attestation verify ${artifact.relativePath} -R ${repository} --source-ref ${sourceRef} --predicate-type ${profile.release.attestationPredicateType}`,
      })),
    },
  );

  return evidencePath;
}

function finalizeFixture({
  releaseAssetsDir,
  profileId,
  releaseTag,
  repository,
}) {
  const finalizeResult = finalizeReleaseAssets({
    profile: profileId,
    'release-tag': releaseTag,
    'release-kind': 'canary',
    'rollout-stage': 'ring-1',
    'monitoring-window-minutes': '60',
    repository,
    'release-assets-dir': releaseAssetsDir,
  });
  const manifest = JSON.parse(readFileSync(finalizeResult.manifestPath, 'utf8'));

  return {
    ...finalizeResult,
    manifest,
  };
}

export function writeReleaseReadinessFixture({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  releaseTag = DEFAULT_RELEASE_TAG,
  repository = DEFAULT_REPOSITORY,
  clean = true,
  assertReady = true,
  resolveReleaseProfileFn = resolveReleaseProfile,
  createReleasePlanFn = createReleasePlan,
} = {}) {
  const profile = resolveReleaseProfileFn(profileId);
  const normalizedReleaseAssetsDir = path.resolve(releaseAssetsDir);
  const normalizedReleaseTag = String(releaseTag ?? '').trim() || DEFAULT_RELEASE_TAG;
  const normalizedRepository = String(repository ?? '').trim() || DEFAULT_REPOSITORY;

  assertSafeReleaseReadinessFixtureDir(normalizedReleaseAssetsDir);

  if (clean) {
    rmSync(normalizedReleaseAssetsDir, { recursive: true, force: true });
  }
  mkdirSync(normalizedReleaseAssetsDir, { recursive: true });

  writeCompleteReleaseFixture({
    releaseAssetsDir: normalizedReleaseAssetsDir,
    profile,
    releaseTag: normalizedReleaseTag,
  });

  const releasePlan = createReleasePlanFn({
    profileId: profile.id,
    releaseTag: normalizedReleaseTag,
    releaseKind: 'canary',
    rolloutStage: 'ring-1',
  });
  const releasePlanTargetCount = countPlanRequiredTargets(releasePlan);
  const finalized = finalizeFixture({
    releaseAssetsDir: normalizedReleaseAssetsDir,
    profileId: profile.id,
    releaseTag: normalizedReleaseTag,
    repository: normalizedRepository,
  });
  const requiredTargetCount = finalized.manifest.releaseCoverage?.requiredTargets?.length ?? 0;

  if (finalized.manifest.releaseCoverage?.status !== 'complete') {
    throw new Error(
      `Readiness fixture generation failed to cover release profile ${profile.id}: missing ${(finalized.manifest.releaseCoverage?.missingTargets ?? []).join(', ')}`,
    );
  }
  if (releasePlanTargetCount !== requiredTargetCount) {
    throw new Error(
      `Readiness fixture release target count drifted from release plan for ${profile.id}: fixture=${requiredTargetCount} plan=${releasePlanTargetCount}`,
    );
  }

  const attestationEvidencePath = writeAttestationEvidenceFixture({
    releaseAssetsDir: normalizedReleaseAssetsDir,
    profile,
    manifest: finalized.manifest,
    repository: normalizedRepository,
    releaseTag: normalizedReleaseTag,
  });
  const readiness = assertReady
    ? assertReleaseReadiness({
      profileId: profile.id,
      releaseAssetsDir: normalizedReleaseAssetsDir,
    })
    : null;

  return {
    releaseAssetsDir: normalizedReleaseAssetsDir,
    manifestPath: finalized.manifestPath,
    checksumsPath: finalized.checksumsPath,
    attestationEvidencePath,
    artifactCount: finalized.manifest.artifacts.length,
    requiredTargetCount,
    releasePlanTargetCount,
    readiness,
  };
}

export function parseArgs(argv) {
  const options = {
    profileId: DEFAULT_RELEASE_PROFILE_ID,
    releaseTag: DEFAULT_RELEASE_TAG,
    repository: DEFAULT_REPOSITORY,
    releaseAssetsDir: DEFAULT_RELEASE_ASSETS_DIR,
    assertReady: true,
    clean: true,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--profile') {
      options.profileId = readOptionValue(argv, index, '--profile');
      index += 1;
      continue;
    }
    if (token === '--release-tag') {
      options.releaseTag = readOptionValue(argv, index, '--release-tag');
      index += 1;
      continue;
    }
    if (token === '--repository') {
      options.repository = readOptionValue(argv, index, '--repository');
      index += 1;
      continue;
    }
    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = path.resolve(
        rootDir,
        readOptionValue(argv, index, '--release-assets-dir'),
      );
      index += 1;
      continue;
    }
    if (token === '--no-assert-ready') {
      options.assertReady = false;
      continue;
    }
    if (token === '--no-clean') {
      options.clean = false;
      continue;
    }
    if (token === '--help') {
      options.help = true;
      continue;
    }

    throw new Error(`Unsupported readiness fixture option: ${token}`);
  }

  return options;
}

function printHelp() {
  process.stdout.write([
    'Usage: node scripts/release/write-readiness-fixture.mjs [options]',
    '',
    'Generate a complete synthetic finalized BirdCoder release assets directory and verify it with release readiness checks.',
    '',
    'Options:',
    '  --profile <id>              Release profile id (default: sdkwork-birdcoder)',
    '  --release-tag <tag>         Synthetic release tag (default: release-fixture)',
    '  --repository <owner/repo>   Repository slug for attestation evidence',
    '  --release-assets-dir <dir>  Output directory (default: artifacts/release-readiness-fixture)',
    '  --no-assert-ready           Generate files without running the readiness assertion',
    '  --no-clean                  Do not remove the output directory before writing',
    '  --help                      Show this help message',
    '',
  ].join('\n'));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const result = writeReleaseReadinessFixture(options);
  process.stdout.write([
    'Release readiness fixture generated.',
    `releaseAssetsDir=${result.releaseAssetsDir}`,
    `manifest=${result.manifestPath}`,
    `checksums=${result.checksumsPath}`,
    `attestationEvidence=${result.attestationEvidencePath}`,
    `artifactCount=${result.artifactCount}`,
    `requiredTargetCount=${result.requiredTargetCount}`,
    `releasePlanTargetCount=${result.releasePlanTargetCount}`,
    result.readiness ? 'Release readiness assertion passed.' : 'Release readiness assertion skipped.',
    '',
  ].join('\n'));
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
