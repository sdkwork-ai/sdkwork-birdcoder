#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { RELEASE_ASSET_MANIFEST_FILE_NAME } from './release-profiles.mjs';
import { writeReleaseSmokeReport } from './release-smoke-contract.mjs';

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

export function smokeDeploymentReleaseAssets({
  family,
  releaseAssetsDir = path.join(process.cwd(), 'artifacts', 'release'),
  platform = 'linux',
  arch = process.arch,
  target = '',
  accelerator = 'cpu',
} = {}) {
  const normalizedFamily = String(family ?? '').trim().toLowerCase();
  const normalizedPlatform = normalizePlatform(platform);
  const normalizedArch = String(arch ?? '').trim().toLowerCase();
  const normalizedAccelerator = String(accelerator ?? '').trim().toLowerCase() || 'cpu';

  if (normalizedFamily !== 'container' && normalizedFamily !== 'kubernetes') {
    throw new Error(`Unsupported deployment family: ${family}`);
  }

  const outputFamilyDir = path.join(
    releaseAssetsDir,
    normalizedFamily,
    normalizedPlatform,
    normalizedArch,
    normalizedAccelerator,
  );
  const manifestPath = path.join(outputFamilyDir, RELEASE_ASSET_MANIFEST_FILE_NAME);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing ${normalizedFamily} release asset manifest: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const archiveRelativePath = String(manifest.archiveRelativePath ?? '').trim();
  const archivePath = path.resolve(releaseAssetsDir, archiveRelativePath);

  if (manifest.family !== normalizedFamily) {
    throw new Error(`${normalizedFamily} manifest family mismatch at ${manifestPath}.`);
  }
  if (!archiveRelativePath || !fs.existsSync(archivePath)) {
    throw new Error(`Missing packaged ${normalizedFamily} archive referenced by ${manifestPath}.`);
  }

  const metadataPath = path.join(outputFamilyDir, 'release-metadata.json');
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Missing ${normalizedFamily} release metadata: ${metadataPath}`);
  }

  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  if (String(metadata.family ?? '').trim() !== normalizedFamily) {
    throw new Error(`${normalizedFamily} metadata family mismatch at ${metadataPath}.`);
  }
  if (String(metadata.accelerator ?? '').trim() !== normalizedAccelerator) {
    throw new Error(`${normalizedFamily} metadata accelerator mismatch at ${metadataPath}.`);
  }

  let valuesPath = '';
  if (normalizedFamily === 'kubernetes') {
    valuesPath = path.join(outputFamilyDir, 'values.release.yaml');
    if (!fs.existsSync(valuesPath)) {
      throw new Error(`Missing kubernetes values.release.yaml: ${valuesPath}`);
    }
  }

  const artifactRelativePaths = Array.isArray(manifest.artifacts)
    ? manifest.artifacts
      .map((artifact) => String(artifact?.relativePath ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
    : [];
  const smokeReport = writeReleaseSmokeReport({
    releaseAssetsDir,
    family: normalizedFamily,
    platform: normalizedPlatform,
    arch: normalizedArch,
    accelerator: normalizedAccelerator,
    target,
    smokeKind: normalizedFamily === 'container' ? 'bundle-contract' : 'chart-contract',
    status: 'passed',
    manifestPath,
    artifactRelativePaths,
    launcherRelativePath: normalizedFamily === 'container' ? 'deploy/docker-compose.yml' : 'chart/Chart.yaml',
    checks: normalizedFamily === 'container'
      ? [
        {
          id: 'deployment-identity',
          status: 'passed',
          detail: 'container release metadata preserves family and accelerator identity',
        },
        {
          id: 'archive-present',
          status: 'passed',
          detail: 'container release archive exists and is referenced by the manifest',
        },
      ]
      : [
        {
          id: 'deployment-identity',
          status: 'passed',
          detail: 'kubernetes release metadata preserves family and accelerator identity',
        },
        {
          id: 'chart-values',
          status: 'passed',
          detail: 'kubernetes values.release.yaml is packaged beside the archive',
        },
      ],
  });

  return {
    family: normalizedFamily,
    platform: normalizedPlatform,
    arch: normalizedArch,
    accelerator: normalizedAccelerator,
    manifestPath,
    metadataPath,
    valuesPath,
    archivePath,
    smokeReportPath: smokeReport.reportPath,
  };
}

export function parseArgs(argv) {
  const options = {
    family: '',
    platform: 'linux',
    arch: process.arch,
    target: '',
    accelerator: 'cpu',
    releaseAssetsDir: path.join(process.cwd(), 'artifacts', 'release'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--family') {
      options.family = readOptionValue(argv, index, '--family');
      index += 1;
      continue;
    }
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
    if (token === '--accelerator') {
      options.accelerator = readOptionValue(argv, index, '--accelerator');
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
  const result = smokeDeploymentReleaseAssets(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
