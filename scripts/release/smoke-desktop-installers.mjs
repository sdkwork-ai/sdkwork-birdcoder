#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  writeDesktopInstallerSmokeReport,
} from './desktop-installer-smoke-contract.mjs';
import {
  assertDesktopInstallerSignatureEvidence,
} from './desktop-installer-trust-evidence.mjs';
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

function isNativeDesktopInstallerArtifact(relativePath) {
  const normalizedRelativePath = String(relativePath ?? '').trim().toLowerCase();
  return (
    normalizedRelativePath.endsWith('.exe')
    || normalizedRelativePath.endsWith('.msi')
    || normalizedRelativePath.endsWith('.deb')
    || normalizedRelativePath.endsWith('.rpm')
    || normalizedRelativePath.endsWith('.appimage')
    || normalizedRelativePath.endsWith('.dmg')
    || normalizedRelativePath.endsWith('.app.tar.gz')
    || normalizedRelativePath.endsWith('.app.zip')
  );
}

function normalizeInstallerManifestArtifact({
  artifact,
  manifestPath,
  expectedTarget,
} = {}) {
  const relativePath = String(artifact?.relativePath ?? '').trim();
  const kind = String(artifact?.kind ?? '').trim();
  const bundle = String(artifact?.bundle ?? '').trim();
  const installerFormat = String(artifact?.installerFormat ?? '').trim();
  const target = String(artifact?.target ?? '').trim();
  if (!relativePath || !isNativeDesktopInstallerArtifact(relativePath)) {
    return null;
  }
  if (kind !== 'installer' || !bundle || !installerFormat || !target) {
    throw new Error(
      `Desktop installer manifest artifact must declare kind=installer, bundle, installerFormat, and target: ${relativePath} in ${manifestPath}.`,
    );
  }
  if (String(expectedTarget ?? '').trim() && target !== String(expectedTarget).trim()) {
    throw new Error(
      `Desktop installer manifest artifact target mismatch in ${manifestPath}: ${relativePath} declares ${target}, expected ${expectedTarget}.`,
    );
  }
  if (bundle !== installerFormat) {
    throw new Error(
      `Desktop installer manifest artifact bundle and installerFormat must match in ${manifestPath}: ${relativePath} declares bundle=${bundle}, installerFormat=${installerFormat}.`,
    );
  }
  const signatureEvidence = assertDesktopInstallerSignatureEvidence({
    artifact,
    manifestPath,
    relativePath,
  });

  return {
    relativePath,
    bundle,
    installerFormat,
    target,
    signatureEvidence,
  };
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

  const installableArtifacts = Array.isArray(manifest.artifacts)
    ? manifest.artifacts
      .map((artifact) => normalizeInstallerManifestArtifact({
        artifact,
        manifestPath,
        expectedTarget: target,
      }))
      .filter(Boolean)
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
    : [];
  const installableArtifactRelativePaths = installableArtifacts.map((artifact) => artifact.relativePath);
  if (installableArtifactRelativePaths.length === 0) {
    throw new Error(`Desktop manifest must include native installer artifacts before smoke: ${manifestPath}.`);
  }
  for (const relativePath of installableArtifactRelativePaths) {
    const installerPath = path.resolve(releaseAssetsDir, relativePath);
    if (!fs.existsSync(installerPath)) {
      throw new Error(
        `Missing native desktop installer artifact referenced by ${manifestPath}: ${relativePath}`,
      );
    }
    if (!fs.statSync(installerPath).isFile()) {
      throw new Error(
        `Native desktop installer artifact referenced by ${manifestPath} must be a file: ${relativePath}`,
      );
    }
  }
  const smokeReport = writeDesktopInstallerSmokeReport({
    releaseAssetsDir,
    platform: normalizedPlatform,
    arch: normalizedArch,
    target,
    manifestPath,
    installableArtifactRelativePaths,
    requiredCompanionArtifactRelativePaths: [],
    installPlanSummaries: installableArtifacts.map((artifact) => ({
      relativePath: artifact.relativePath,
      format: artifact.installerFormat,
      bundle: artifact.bundle,
      target: artifact.target,
      signatureEvidence: artifact.signatureEvidence,
      platform: normalizedPlatform,
      stepCount: 1,
    })),
    installReadyLayout: {
      mode: 'native-installers',
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
