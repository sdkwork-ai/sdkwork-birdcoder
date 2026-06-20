import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { sha256Value } from './sdkwork-utils-digest.mjs';

import {
  normalizeCodingServerOpenApiEvidenceSummary,
} from './release/coding-server-openapi-release-evidence.mjs';

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();
  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

export function parseArgs(argv) {
  const options = {
    openApiSnapshotPath: undefined,
    releaseAssetsDir: path.join(process.cwd(), 'artifacts', 'release'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = path.resolve(readOptionValue(argv, index, '--release-assets-dir'));
      index += 1;
      continue;
    }
    if (token === '--openapi-snapshot') {
      options.openApiSnapshotPath = path.resolve(readOptionValue(argv, index, '--openapi-snapshot'));
      index += 1;
      continue;
    }
  }

  return options;
}

function computeSha256(content) {
  return sha256Value(content);
}

function normalizeRelativePath(value) {
  return String(value ?? '').replace(/\\/gu, '/');
}

function resolveDevelopmentWorkspaceRoot(releaseAssetsDir) {
  return path.dirname(path.dirname(path.resolve(releaseAssetsDir)));
}

function resolveDevelopmentSnapshotPath(releaseAssetsDir, openApiSnapshotPath) {
  if (openApiSnapshotPath) {
    return path.resolve(openApiSnapshotPath);
  }

  const workspaceRoot = resolveDevelopmentWorkspaceRoot(releaseAssetsDir);
  const deploymentSnapshotPath = path.join(
    workspaceRoot,
    'deployments',
    'server-windows',
    'x64',
    'openapi',
    'coding-server-v1.json',
  );
  if (fs.existsSync(deploymentSnapshotPath)) {
    return deploymentSnapshotPath;
  }

  return path.join(
    workspaceRoot,
    'artifacts',
    'openapi',
    'coding-server-v1.json',
  );
}

function readDevelopmentOpenApiCodegenInput({
  manifestPath,
  openApiSnapshotPath,
  releaseAssetsDir,
}) {
  const canonicalSnapshotPath = resolveDevelopmentSnapshotPath(
    releaseAssetsDir,
    openApiSnapshotPath,
  );
  if (!fs.existsSync(canonicalSnapshotPath)) {
    throw new Error(
      [
        `Missing finalized release manifest: ${manifestPath}`,
        `Missing development coding-server OpenAPI snapshot: ${canonicalSnapshotPath}`,
      ].join('\n'),
    );
  }

  const source = fs.readFileSync(canonicalSnapshotPath, 'utf8');
  const document = JSON.parse(source);
  const workspaceRoot = resolveDevelopmentWorkspaceRoot(releaseAssetsDir);
  const canonicalRelativePath = normalizeRelativePath(
    path.relative(workspaceRoot, canonicalSnapshotPath),
  );

  return {
    releaseTag: 'development',
    manifestPath: null,
    canonicalRelativePath,
    canonicalSnapshotPath,
    mirroredRelativePaths: [canonicalRelativePath],
    targetCount: 1,
    targets: ['development'],
    sha256: computeSha256(source),
    openapi: String(document.openapi ?? '').trim(),
    version: String(document.info?.version ?? '').trim(),
    title: String(document.info?.title ?? '').trim(),
  };
}

export function readCodingServerOpenApiCodegenInput({
  openApiSnapshotPath,
  releaseAssetsDir = path.join(process.cwd(), 'artifacts', 'release'),
} = {}) {
  const manifestPath = path.join(releaseAssetsDir, 'release-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return readDevelopmentOpenApiCodegenInput({
      manifestPath,
      openApiSnapshotPath,
      releaseAssetsDir,
    });
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest.codingServerOpenApiEvidence) {
    throw new Error('Missing finalized manifest codingServerOpenApiEvidence summary.');
  }

  const summary = normalizeCodingServerOpenApiEvidenceSummary(manifest.codingServerOpenApiEvidence);
  const canonicalSnapshotPath = path.resolve(releaseAssetsDir, summary.canonicalRelativePath);
  if (!fs.existsSync(canonicalSnapshotPath)) {
    throw new Error(`Missing canonical coding-server OpenAPI snapshot: ${canonicalSnapshotPath}`);
  }

  return {
    releaseTag: String(manifest.releaseTag ?? '').trim(),
    manifestPath,
    canonicalRelativePath: summary.canonicalRelativePath,
    canonicalSnapshotPath,
    mirroredRelativePaths: summary.mirroredRelativePaths,
    targetCount: summary.targetCount,
    targets: summary.targets,
    sha256: summary.sha256,
    openapi: summary.openapi,
    version: summary.version,
    title: summary.title,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = readCodingServerOpenApiCodegenInput(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
