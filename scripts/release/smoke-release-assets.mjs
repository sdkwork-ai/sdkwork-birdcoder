import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { RELEASE_ASSET_MANIFEST_FILE_NAME } from './release-profiles.mjs';
import { writeReleaseSmokeReport } from './release-smoke-contract.mjs';
import { smokeDeploymentReleaseAssets } from './smoke-deployment-release-assets.mjs';
import { smokeDesktopInstallers } from './smoke-desktop-installers.mjs';
import { smokeServerReleaseAssets } from './smoke-server-release-assets.mjs';

function readOption(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) {
    return '';
  }

  return process.argv[index + 1];
}

function smokeWebReleaseAssets({
  releaseAssetsDir = path.join(process.cwd(), 'artifacts', 'release'),
} = {}) {
  const manifestPath = path.join(releaseAssetsDir, 'web', RELEASE_ASSET_MANIFEST_FILE_NAME);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing web release asset manifest: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const archiveRelativePath = String(manifest.archiveRelativePath ?? '').trim();
  const archivePath = path.resolve(releaseAssetsDir, archiveRelativePath);

  if (manifest.family !== 'web') {
    throw new Error(`Web manifest family mismatch at ${manifestPath}.`);
  }
  if (!archiveRelativePath || !fs.existsSync(archivePath)) {
    throw new Error(`Missing packaged web archive referenced by ${manifestPath}.`);
  }

  const artifactRelativePaths = Array.isArray(manifest.artifacts)
    ? manifest.artifacts
      .map((artifact) => String(artifact?.relativePath ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
    : [];
  const smokeReport = writeReleaseSmokeReport({
    releaseAssetsDir,
    family: 'web',
    platform: 'web',
    arch: 'any',
    smokeKind: 'bundle-contract',
    status: 'passed',
    manifestPath,
    artifactRelativePaths,
    launcherRelativePath: 'app',
    checks: [
      {
        id: 'archive-present',
        status: 'passed',
        detail: 'web release archive exists and is referenced by the manifest',
      },
    ],
  });

  return {
    family: 'web',
    manifestPath,
    archivePath,
    smokeReportPath: smokeReport.reportPath,
  };
}

export function smokeReleaseAssets({
  family = '',
  releaseAssetsDir = '',
  platform = process.platform,
  arch = process.arch,
  target = '',
  accelerator = 'cpu',
} = {}) {
  const normalizedFamily = String(family ?? '').trim().toLowerCase();
  const normalizedAssetsDir = String(releaseAssetsDir ?? '').trim();
  if (!normalizedFamily) {
    throw new Error('A release family is required for smoke verification.');
  }
  if (!normalizedAssetsDir) {
    throw new Error('A release assets directory is required for smoke verification.');
  }

  if (normalizedFamily === 'desktop') {
    return smokeDesktopInstallers({
      releaseAssetsDir: normalizedAssetsDir,
      platform,
      arch,
      target,
    });
  }
  if (normalizedFamily === 'server') {
    return smokeServerReleaseAssets({
      releaseAssetsDir: normalizedAssetsDir,
      platform,
      arch,
      target,
    });
  }
  if (normalizedFamily === 'container' || normalizedFamily === 'kubernetes') {
    return smokeDeploymentReleaseAssets({
      family: normalizedFamily,
      releaseAssetsDir: normalizedAssetsDir,
      platform,
      arch,
      target,
      accelerator,
    });
  }
  if (normalizedFamily === 'web') {
    return smokeWebReleaseAssets({
      releaseAssetsDir: normalizedAssetsDir,
    });
  }

  throw new Error(`Unsupported release family: ${family}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = smokeReleaseAssets({
    family: process.argv[2] || readOption('--family'),
    releaseAssetsDir: readOption('--release-assets-dir'),
    platform: readOption('--platform') || process.platform,
    arch: readOption('--arch') || process.arch,
    target: readOption('--target') || '',
    accelerator: readOption('--accelerator') || 'cpu',
  });
  console.log(JSON.stringify(result, null, 2));
}
