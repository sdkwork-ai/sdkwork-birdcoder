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

function normalizeRelativePath(targetPath) {
  return String(targetPath ?? '').split(path.sep).join('/');
}

export function smokeServerReleaseAssets({
  releaseAssetsDir = path.join(process.cwd(), 'artifacts', 'release'),
  platform = process.platform,
  arch = process.arch,
  target = '',
} = {}) {
  const normalizedPlatform = normalizePlatform(platform);
  const normalizedArch = String(arch ?? '').trim().toLowerCase();
  const manifestPath = path.join(
    releaseAssetsDir,
    'server',
    normalizedPlatform,
    normalizedArch,
    RELEASE_ASSET_MANIFEST_FILE_NAME,
  );

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing server release asset manifest: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const archiveRelativePath = String(manifest.archiveRelativePath ?? '').trim();
  const archivePath = path.resolve(releaseAssetsDir, archiveRelativePath);

  if (manifest.family !== 'server') {
    throw new Error(`Server manifest family mismatch at ${manifestPath}.`);
  }
  if (String(manifest.platform ?? '').trim() !== normalizedPlatform) {
    throw new Error(`Server manifest platform mismatch at ${manifestPath}.`);
  }
  if (String(manifest.arch ?? '').trim() !== normalizedArch) {
    throw new Error(`Server manifest architecture mismatch at ${manifestPath}.`);
  }
  if (!archiveRelativePath || !fs.existsSync(archivePath)) {
    throw new Error(`Missing packaged server archive referenced by ${manifestPath}.`);
  }

  const artifactRelativePaths = Array.isArray(manifest.artifacts)
    ? manifest.artifacts
      .map((artifact) => String(artifact?.relativePath ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
    : [];
  const openApiRelativePath = normalizeRelativePath(
    path.join('server', normalizedPlatform, normalizedArch, 'openapi', 'coding-server-v1.json'),
  );
  const openApiPath = path.resolve(releaseAssetsDir, openApiRelativePath);

  if (!artifactRelativePaths.includes(openApiRelativePath)) {
    throw new Error(`Missing coding-server OpenAPI sidecar reference in ${manifestPath}.`);
  }
  if (!fs.existsSync(openApiPath)) {
    throw new Error(`Missing coding-server OpenAPI sidecar at ${openApiPath}.`);
  }

  const smokeReport = writeReleaseSmokeReport({
    releaseAssetsDir,
    family: 'server',
    platform: normalizedPlatform,
    arch: normalizedArch,
    target,
    smokeKind: 'bundle-contract',
    status: 'passed',
    manifestPath,
    artifactRelativePaths,
    launcherRelativePath: 'server',
    checks: [
      {
        id: 'manifest-target',
        status: 'passed',
        detail: 'server manifest matches requested platform and architecture',
      },
      {
        id: 'archive-present',
        status: 'passed',
        detail: 'server release archive exists and is referenced by the manifest',
      },
      {
        id: 'openapi-sidecar-present',
        status: 'passed',
        detail: 'server release assets include the generated coding-server OpenAPI snapshot sidecar',
      },
    ],
  });

  return {
    family: 'server',
    platform: normalizedPlatform,
    arch: normalizedArch,
    manifestPath,
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
  const result = smokeServerReleaseAssets(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
