import fs from 'node:fs';
import path from 'node:path';

import { sha256File } from '../sdkwork-utils-digest.mjs';

export const BIRDCODER_APP_API_OPENAPI_BASENAME = 'birdcoder-app-api.openapi.json';

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

function resolveServerTarget(asset = {}) {
  const platform = String(asset.platform ?? '').trim();
  const arch = String(asset.arch ?? '').trim();
  return [platform, arch].filter(Boolean).join('/');
}

function collectServerAppApiArtifacts(assets = []) {
  const serverAssets = Array.isArray(assets)
    ? assets.filter((asset) => String(asset?.family ?? '').trim() === 'server')
    : [];
  const records = [];

  for (const asset of serverAssets) {
    const target = resolveServerTarget(asset);
    const artifactPaths = (Array.isArray(asset.artifacts) ? asset.artifacts : [])
      .map((artifact) => normalizeRelativePath(artifact?.relativePath ?? ''))
      .filter(Boolean);
    const openApiPaths = artifactPaths.filter(
      (artifactPath) => artifactPath.endsWith(`/openapi/${BIRDCODER_APP_API_OPENAPI_BASENAME}`),
    );
    if (openApiPaths.length !== 1) {
      throw new Error(
        `Expected exactly one BirdCoder App API OpenAPI sidecar for finalized server asset ${target || 'unknown-target'}, found ${openApiPaths.length}.`,
      );
    }
    records.push({ relativePath: openApiPaths[0], target });
  }

  return records.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function normalizeBirdcoderAppApiEvidenceSummary(summary = {}) {
  return {
    canonicalRelativePath: normalizeRelativePath(summary.canonicalRelativePath ?? ''),
    targetCount: typeof summary.targetCount === 'number' ? summary.targetCount : 0,
    targets: normalizeStringArray(summary.targets ?? []),
    sha256: String(summary.sha256 ?? '').trim().toLowerCase(),
    openapi: String(summary.openapi ?? '').trim(),
    version: String(summary.version ?? '').trim(),
    title: String(summary.title ?? '').trim(),
  };
}

export function createBirdcoderAppApiEvidence({
  releaseAssetsDir,
  assets = [],
} = {}) {
  const records = collectServerAppApiArtifacts(assets);
  if (records.length === 0) {
    return null;
  }

  const detailedRecords = records.map((record) => {
    const absolutePath = path.resolve(releaseAssetsDir, record.relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Missing packaged BirdCoder App API OpenAPI snapshot: ${absolutePath}`);
    }
    const document = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    return {
      ...record,
      sha256: sha256File(absolutePath),
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
      throw new Error(
        'Packaged BirdCoder App API OpenAPI sidecars must be byte-identical across server targets.',
      );
    }
  }

  const targets = normalizeStringArray(detailedRecords.map((record) => record.target));
  return {
    canonicalRelativePath: canonicalRecord.relativePath,
    targetCount: targets.length,
    targets,
    sha256: canonicalRecord.sha256,
    openapi: canonicalRecord.openapi,
    version: canonicalRecord.version,
    title: canonicalRecord.title,
  };
}
