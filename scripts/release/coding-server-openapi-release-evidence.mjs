import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const CODING_SERVER_OPENAPI_SNAPSHOT_BASENAME = 'coding-server-v1.json';

function normalizeStringArray(values) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value ?? '').trim())
      .filter(Boolean),
  )).sort((left, right) => left.localeCompare(right));
}

function normalizeRelativePath(targetPath) {
  return String(targetPath ?? '').split(path.sep).join('/');
}

function computeSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function resolveServerTarget(asset = {}) {
  const platform = String(asset.platform ?? '').trim();
  const arch = String(asset.arch ?? '').trim();
  return [platform, arch].filter(Boolean).join('/');
}

function collectServerOpenApiArtifacts(assets = []) {
  const serverAssets = Array.isArray(assets)
    ? assets.filter((asset) => String(asset?.family ?? '').trim() === 'server')
    : [];
  if (serverAssets.length === 0) {
    return [];
  }

  const records = [];
  for (const asset of serverAssets) {
    const target = resolveServerTarget(asset);
    const artifactPaths = (Array.isArray(asset.artifacts) ? asset.artifacts : [])
      .map((artifact) => normalizeRelativePath(artifact?.relativePath ?? ''))
      .filter(Boolean);
    const openApiPaths = artifactPaths.filter((artifactPath) => artifactPath.endsWith(`/openapi/${CODING_SERVER_OPENAPI_SNAPSHOT_BASENAME}`));
    if (openApiPaths.length === 0) {
      throw new Error(`Missing coding-server OpenAPI sidecar reference for finalized server asset ${target || 'unknown-target'}.`);
    }

    for (const relativePath of openApiPaths) {
      records.push({
        relativePath,
        target,
      });
    }
  }

  return records.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function normalizeCodingServerOpenApiEvidenceSummary(summary = {}) {
  return {
    canonicalRelativePath: normalizeRelativePath(summary.canonicalRelativePath ?? ''),
    mirroredRelativePaths: normalizeStringArray(summary.mirroredRelativePaths ?? []),
    targetCount: typeof summary.targetCount === 'number' ? summary.targetCount : 0,
    targets: normalizeStringArray(summary.targets ?? []),
    sha256: String(summary.sha256 ?? '').trim().toLowerCase(),
    openapi: String(summary.openapi ?? '').trim(),
    version: String(summary.version ?? '').trim(),
    title: String(summary.title ?? '').trim(),
  };
}

export function createCodingServerOpenApiEvidence({
  releaseAssetsDir,
  assets = [],
} = {}) {
  const records = collectServerOpenApiArtifacts(assets);
  if (records.length === 0) {
    return null;
  }

  const detailedRecords = records.map((record) => {
    const absolutePath = path.resolve(releaseAssetsDir, record.relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Missing packaged coding-server OpenAPI snapshot: ${absolutePath}`);
    }

    const document = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    return {
      ...record,
      sha256: computeSha256(absolutePath),
      openapi: String(document?.openapi ?? '').trim(),
      version: String(document?.info?.version ?? '').trim(),
      title: String(document?.info?.title ?? '').trim(),
    };
  });

  const canonicalRecord = detailedRecords[0];
  for (const record of detailedRecords.slice(1)) {
    if (
      record.sha256 !== canonicalRecord.sha256
      || record.openapi !== canonicalRecord.openapi
      || record.version !== canonicalRecord.version
      || record.title !== canonicalRecord.title
    ) {
      throw new Error('Packaged coding-server OpenAPI sidecars must be byte-identical across finalized server targets.');
    }
  }

  const targets = normalizeStringArray(detailedRecords.map((record) => record.target));

  return {
    canonicalRelativePath: canonicalRecord.relativePath,
    mirroredRelativePaths: detailedRecords.map((record) => record.relativePath),
    targetCount: targets.length,
    targets,
    sha256: canonicalRecord.sha256,
    openapi: canonicalRecord.openapi,
    version: canonicalRecord.version,
    title: canonicalRecord.title,
  };
}
