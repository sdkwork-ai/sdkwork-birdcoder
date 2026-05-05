import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { assertReleaseReadiness } from './assert-release-readiness.mjs';
import { finalizeReleaseAssets } from './finalize-release-assets.mjs';
import {
  DEFAULT_RELEASE_PROFILE_ID,
  RELEASE_ASSET_MANIFEST_FILE_NAME,
  resolveReleaseProfile,
} from './release-profiles.mjs';
import { writeDesktopInstallerSmokeReport } from './desktop-installer-smoke-contract.mjs';
import {
  writeDesktopStartupEvidence,
  writeDesktopStartupSmokeReport,
} from './desktop-startup-smoke-contract.mjs';
import { writeReleaseSmokeReport } from './release-smoke-contract.mjs';

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-complete-matrix-'));

function writeFile(targetPath, value) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, value);
}

function writeJson(targetPath, value) {
  writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeRelativePath(targetPath) {
  return targetPath.split(path.sep).join('/');
}

function writeArtifact(releaseAssetsDir, relativePath, value = '') {
  const normalizedRelativePath = relativePath.replaceAll('\\', '/');
  writeFile(
    path.join(releaseAssetsDir, normalizedRelativePath),
    value || `release artifact: ${normalizedRelativePath}\n`,
  );
  return normalizedRelativePath;
}

function writeReleaseAssetManifest({
  releaseAssetsDir,
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
  const archiveRelativePath = artifactEntries.find((entry) => entry.relativePath.endsWith('.tar.gz'))?.relativePath
    ?? artifactEntries[0]?.relativePath;
  const manifestPath = path.join(manifestDir, RELEASE_ASSET_MANIFEST_FILE_NAME);
  writeJson(manifestPath, {
    family,
    profileId: DEFAULT_RELEASE_PROFILE_ID,
    productName: 'SDKWork BirdCoder',
    releaseTag: 'release-complete-matrix',
    platform,
    arch,
    target,
    accelerator,
    archiveFormat: 'tar.gz',
    archiveRelativePath,
    artifacts: artifactEntries.map((artifact) => ({
      ...artifact,
      size: fs.statSync(path.join(releaseAssetsDir, artifact.relativePath)).size,
    })),
    createdAt: '2026-04-12T00:00:00.000Z',
  });

  return manifestPath;
}

function writeDesktopTarget({
  releaseAssetsDir,
  entry,
  artifactRelativePaths,
}) {
  const manifestPath = writeReleaseAssetManifest({
    releaseAssetsDir,
    family: 'desktop',
    platform: entry.platform,
    arch: entry.arch,
    target: entry.target,
    artifacts: artifactRelativePaths,
  });
  writeDesktopInstallerSmokeReport({
    releaseAssetsDir,
    platform: entry.platform,
    arch: entry.arch,
    target: entry.target,
    manifestPath,
    installableArtifactRelativePaths: artifactRelativePaths,
    requiredCompanionArtifactRelativePaths: [],
    installPlanSummaries: artifactRelativePaths.map((relativePath) => ({
      relativePath,
      format: 'native-installer',
      platform: entry.platform,
      stepCount: 1,
    })),
    installReadyLayout: {
      mode: 'native-installers',
      ready: true,
    },
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
    artifactRelativePaths,
    readinessEvidence,
  });
  writeDesktopStartupSmokeReport({
    releaseAssetsDir,
    platform: entry.platform,
    arch: entry.arch,
    target: entry.target,
    manifestPath,
    artifactRelativePaths,
    capturedEvidenceRelativePath: normalizeRelativePath(
      path.relative(releaseAssetsDir, startupEvidence.capturedEvidencePath),
    ),
    checks: [
      {
        id: 'shell-mounted',
        status: 'passed',
        detail: 'desktop shell mounted successfully',
      },
    ],
  });
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

function writeWebTarget(releaseAssetsDir) {
  const artifactRelativePath = writeArtifact(
    releaseAssetsDir,
    'web/sdkwork-birdcoder-web-release-complete-matrix.tar.gz',
  );
  const manifestPath = writeReleaseAssetManifest({
    releaseAssetsDir,
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
  });
}

function writeServerTarget(releaseAssetsDir, entry) {
  const artifactRelativePath = writeArtifact(
    releaseAssetsDir,
    `server/${entry.platform}/${entry.arch}/sdkwork-birdcoder-server-${entry.platform}-${entry.arch}.tar.gz`,
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
  });
}

function writeDeploymentTarget(releaseAssetsDir, family, entry) {
  const artifactRelativePath = writeArtifact(
    releaseAssetsDir,
    `${family}/${entry.platform}/${entry.arch}/${entry.accelerator}/sdkwork-birdcoder-${family}-${entry.platform}-${entry.arch}-${entry.accelerator}.tar.gz`,
  );
  const manifestPath = writeReleaseAssetManifest({
    releaseAssetsDir,
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
    smokeKind: 'bundle-contract',
    status: 'passed',
    manifestPath,
    artifactRelativePaths: [artifactRelativePath],
  });
}

function writeCompleteReleaseFixture(releaseAssetsDir, {
  desktopArtifacts,
}) {
  const profile = resolveReleaseProfile(DEFAULT_RELEASE_PROFILE_ID);
  writeWebTarget(releaseAssetsDir);

  for (const entry of profile.desktop.matrix) {
    const artifactRelativePaths = desktopArtifacts(entry).map((artifact) => {
      const artifactEntry = typeof artifact === 'string'
        ? { relativePath: artifact }
        : { ...artifact };
      writeArtifact(releaseAssetsDir, artifactEntry.relativePath);
      return artifactEntry;
    });
    writeDesktopTarget({
      releaseAssetsDir,
      entry,
      artifactRelativePaths,
    });
  }

  for (const entry of profile.server.matrix) {
    writeServerTarget(releaseAssetsDir, entry);
  }
  for (const entry of profile.container.matrix) {
    writeDeploymentTarget(releaseAssetsDir, 'container', entry);
  }
  for (const entry of profile.kubernetes.matrix) {
    writeDeploymentTarget(releaseAssetsDir, 'kubernetes', entry);
  }
}

function finalizeFixture(releaseAssetsDir) {
  return finalizeReleaseAssets({
    profile: DEFAULT_RELEASE_PROFILE_ID,
    'release-tag': 'release-complete-matrix',
    'release-kind': 'canary',
    'rollout-stage': 'ring-1',
    'release-assets-dir': releaseAssetsDir,
  });
}

function writeAttestationEvidenceFixture({
  releaseAssetsDir,
  manifest,
}) {
  const profile = resolveReleaseProfile(DEFAULT_RELEASE_PROFILE_ID);
  const releaseTag = String(manifest.releaseTag ?? '').trim();
  const repository = String(manifest.repository ?? '').trim();
  writeJson(
    path.join(releaseAssetsDir, profile.release.attestationEvidenceFileName),
    {
      schemaVersion: 1,
      repository,
      releaseTag,
      sourceRef: releaseTag ? `refs/tags/${releaseTag}` : '',
      generatedAt: '2026-04-12T00:00:01.000Z',
      predicateType: profile.release.attestationPredicateType,
      signerWorkflow: profile.release.attestationSignerWorkflowPath,
      artifacts: manifest.artifacts.map((artifact) => ({
        relativePath: artifact.relativePath,
        sha256: artifact.sha256,
        repository,
        releaseTag,
        sourceRef: releaseTag ? `refs/tags/${releaseTag}` : '',
        predicateType: profile.release.attestationPredicateType,
        signerWorkflow: profile.release.attestationSignerWorkflowPath,
        verified: true,
        verifiedAt: '2026-04-12T00:00:01.000Z',
        verificationCommand: `gh attestation verify ${artifact.relativePath}`,
      })),
    },
  );
}

const incompleteDesktopReleaseAssetsDir = path.join(fixtureRoot, 'incomplete-desktop');
writeCompleteReleaseFixture(incompleteDesktopReleaseAssetsDir, {
  desktopArtifacts: (entry) => [
    `desktop/${entry.platform}/${entry.arch}/sdkwork-birdcoder-desktop-${entry.platform}-${entry.arch}.tar.gz`,
  ],
});
const incompleteResult = finalizeFixture(incompleteDesktopReleaseAssetsDir);
const incompleteManifest = JSON.parse(fs.readFileSync(incompleteResult.manifestPath, 'utf8'));
assert.equal(
  incompleteManifest.releaseCoverage.status,
  'partial',
  'generic desktop .tar.gz archives must not satisfy native installer release coverage',
);
assert.match(
  incompleteManifest.releaseCoverage.missingTargets.join(','),
  /desktop\/windows\/x64\/nsis/,
);
assert.throws(
  () => assertReleaseReadiness({
    profileId: DEFAULT_RELEASE_PROFILE_ID,
    releaseAssetsDir: incompleteDesktopReleaseAssetsDir,
  }),
  /releaseCoverage.status=partial/,
);

const completeReleaseAssetsDir = path.join(fixtureRoot, 'complete');
writeCompleteReleaseFixture(completeReleaseAssetsDir, {
  desktopArtifacts: (entry) => entry.bundles.map((bundle) => (
    {
      relativePath: `desktop/${entry.platform}/${entry.arch}/${desktopBundleFileName(entry, bundle)}`,
      kind: 'installer',
      bundle,
      installerFormat: bundle,
      target: entry.target,
    }
  )),
});
const completeResult = finalizeFixture(completeReleaseAssetsDir);
const completeManifest = JSON.parse(fs.readFileSync(completeResult.manifestPath, 'utf8'));
writeAttestationEvidenceFixture({
  releaseAssetsDir: completeReleaseAssetsDir,
  manifest: completeManifest,
});
assert.equal(completeManifest.releaseCoverage.status, 'complete');
assert.equal(completeManifest.releaseCoverage.allowPartialRelease, false);
assert.deepEqual(completeManifest.releaseCoverage.missingTargets, []);
assert.deepEqual(
  completeManifest.releaseCoverage.presentTargets,
  completeManifest.releaseCoverage.requiredTargets,
);
const readiness = assertReleaseReadiness({
  profileId: DEFAULT_RELEASE_PROFILE_ID,
  releaseAssetsDir: completeReleaseAssetsDir,
});
assert.equal(readiness.requiredTargetCount, 27);
assert.equal(readiness.artifactCount, completeManifest.artifacts.length);
assert.equal(
  fs.readFileSync(completeResult.checksumsPath, 'utf8'),
  `${completeManifest.artifacts.map((artifact) => `${artifact.sha256}  ${artifact.relativePath}`).join('\n')}\n`,
  'complete release matrix checksums must exactly match the finalized manifest artifacts publication view',
);

fs.rmSync(fixtureRoot, { recursive: true, force: true });
console.log('release readiness complete matrix contract passed.');
