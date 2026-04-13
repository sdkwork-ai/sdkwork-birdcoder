import fs from 'node:fs';
import path from 'node:path';

export const STUDIO_PREVIEW_EVIDENCE_ARCHIVE_PATH = path.join(
  'studio',
  'preview',
  'studio-preview-evidence.json',
);

function normalizeStringArray(values) {
  return Array.from(new Set(
    values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean),
  )).sort((left, right) => left.localeCompare(right));
}

export function resolveStudioPreviewEvidenceArchivePath({
  releaseAssetsDir,
} = {}) {
  return path.join(releaseAssetsDir, STUDIO_PREVIEW_EVIDENCE_ARCHIVE_PATH);
}

export function readStudioPreviewEvidenceArchive({
  releaseAssetsDir,
} = {}) {
  const archivePath = resolveStudioPreviewEvidenceArchivePath({
    releaseAssetsDir,
  });
  if (!fs.existsSync(archivePath)) {
    return null;
  }

  const archive = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
  if (!Array.isArray(archive.entries)) {
    throw new Error(`Studio preview evidence archive entries must be an array: ${archivePath}`);
  }

  return {
    archivePath,
    archive,
  };
}

export function summarizeStudioPreviewEvidenceArchive({
  releaseAssetsDir,
} = {}) {
  const resolved = readStudioPreviewEvidenceArchive({
    releaseAssetsDir,
  });
  if (!resolved) {
    return undefined;
  }

  const normalizedEntries = resolved.archive.entries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      evidenceKey: String(entry.evidenceKey ?? '').trim(),
      channel: String(entry.channel ?? '').trim(),
      projectId: String(entry.projectId ?? '').trim(),
      launchedAt: typeof entry.launchedAt === 'number' ? entry.launchedAt : null,
    }))
    .filter((entry) => entry.evidenceKey.length > 0);

  return {
    archivePath: resolved.archivePath,
    archiveRelativePath: STUDIO_PREVIEW_EVIDENCE_ARCHIVE_PATH.split(path.sep).join('/'),
    entryCount: normalizedEntries.length,
    channels: normalizeStringArray(normalizedEntries.map((entry) => entry.channel)),
    projectIds: normalizeStringArray(normalizedEntries.map((entry) => entry.projectId)),
    latestLaunchedAt: normalizedEntries.reduce((latest, entry) => {
      if (typeof entry.launchedAt !== 'number') {
        return latest;
      }

      return latest === null || entry.launchedAt > latest ? entry.launchedAt : latest;
    }, null),
  };
}
