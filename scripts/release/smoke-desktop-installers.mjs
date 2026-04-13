#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  writeDesktopInstallerSmokeReport,
} from './desktop-installer-smoke-contract.mjs';
import { RELEASE_ASSET_MANIFEST_FILE_NAME } from './release-profiles.mjs';

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();
  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function normalizePlatform(platform) {
  const normalizedPlatform = String(platform ?? '').trim().toLowerCase();
  if (normalizedPlatform === 'win32') {
    return 'windows';
  }
  if (normalizedPlatform === 'darwin') {
    return 'macos';
  }

  return normalizedPlatform;
}

function resolveManifestPath({
  releaseAssetsDir,
  platform,
  arch,
}) {
  return path.join(releaseAssetsDir, 'desktop', platform, arch, RELEASE_ASSET_MANIFEST_FILE_NAME);
}

function readManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing desktop release asset manifest: ${manifestPath}`);
  }

  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

export function smokeDesktopInstallers({
  releaseAssetsDir = path.join(process.cwd(), 'artifacts', 'release'),
  platform = process.platform,
  arch = process.arch,
  target = '',
} = {}) {
  const normalizedPlatform = normalizePlatform(platform);
  const normalizedArch = String(arch ?? '').trim().toLowerCase();
  const manifestPath = resolveManifestPath({
    releaseAssetsDir,
    platform: normalizedPlatform,
    arch: normalizedArch,
  });
  const manifest = readManifest(manifestPath);
  const archiveRelativePath = String(manifest.archiveRelativePath ?? '').trim();
  const archivePath = path.resolve(releaseAssetsDir, archiveRelativePath);

  if (manifest.family !== 'desktop') {
    throw new Error(`Desktop manifest family mismatch at ${manifestPath}.`);
  }
  if (String(manifest.platform ?? '').trim() !== normalizedPlatform) {
    throw new Error(`Desktop manifest platform mismatch at ${manifestPath}.`);
  }
  if (String(manifest.arch ?? '').trim() !== normalizedArch) {
    throw new Error(`Desktop manifest architecture mismatch at ${manifestPath}.`);
  }
  if (!archiveRelativePath || !fs.existsSync(archivePath)) {
    throw new Error(`Missing packaged desktop archive referenced by ${manifestPath}.`);
  }

  if (!archiveRelativePath.endsWith('.tar.gz')) {
    throw new Error(
      `Desktop packaged archive must end with .tar.gz, received ${archiveRelativePath}.`,
    );
  }

  const artifactRelativePaths = Array.isArray(manifest.artifacts)
    ? manifest.artifacts
      .map((artifact) => String(artifact?.relativePath ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
    : [];
  const smokeReport = writeDesktopInstallerSmokeReport({
    releaseAssetsDir,
    platform: normalizedPlatform,
    arch: normalizedArch,
    target,
    manifestPath,
    installableArtifactRelativePaths: [archiveRelativePath],
    requiredCompanionArtifactRelativePaths: [],
    installPlanSummaries: [
      {
        relativePath: archiveRelativePath,
        format: 'bundle-archive',
        platform: normalizedPlatform,
        stepCount: 1,
      },
    ],
    installReadyLayout: {
      mode: 'bundle-archive',
      ready: true,
    },
  });

  return {
    family: 'desktop',
    platform: normalizedPlatform,
    arch: normalizedArch,
    manifestPath,
    manifest,
    archivePath,
    smokeReportPath: smokeReport.reportPath,
  };
}

export function parseArgs(argv) {
  const options = {
    platform: process.platform,
    arch: process.arch,
    target: '',
    releaseAssetsDir: path.join(process.cwd(), 'artifacts', 'release'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--platform') {
      options.platform = readOptionValue(argv, index, '--platform');
      index += 1;
      continue;
    }
    if (token === '--arch') {
      options.arch = readOptionValue(argv, index, '--arch');
      index += 1;
      continue;
    }
    if (token === '--target') {
      options.target = readOptionValue(argv, index, '--target');
      index += 1;
      continue;
    }
    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = path.resolve(readOptionValue(argv, index, '--release-assets-dir'));
      index += 1;
    }
  }

  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = smokeDesktopInstallers(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
