import fs from 'node:fs';
import path from 'node:path';

export const STUDIO_TEST_EVIDENCE_ARCHIVE_PATH = path.join(
  'studio',
  'test',
  'studio-test-evidence.json',
);

function normalizeStringArray(values) {
  return Array.from(new Set(
    values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean),
  )).sort((left, right) => left.localeCompare(right));
}

export function resolveStudioTestEvidenceArchivePath({
  releaseAssetsDir,
} = {}) {
  return path.join(releaseAssetsDir, STUDIO_TEST_EVIDENCE_ARCHIVE_PATH);
}

export function readStudioTestEvidenceArchive({
  releaseAssetsDir,
} = {}) {
  const archivePath = resolveStudioTestEvidenceArchivePath({
    releaseAssetsDir,
  });
  if (!fs.existsSync(archivePath)) {
    return null;
  }

  const archive = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
  if (!Array.isArray(archive.entries)) {
    throw new Error(`Studio test evidence archive entries must be an array: ${archivePath}`);
  }

  return {
    archivePath,
    archive,
  };
}

export function summarizeStudioTestEvidenceArchive({
  releaseAssetsDir,
} = {}) {
  const resolved = readStudioTestEvidenceArchive({
    releaseAssetsDir,
  });
  if (!resolved) {
    return undefined;
  }

  const normalizedEntries = resolved.archive.entries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      evidenceKey: String(entry.evidenceKey ?? '').trim(),
      command: String(entry.command ?? '').trim(),
      projectId: String(entry.projectId ?? '').trim(),
      launchedAt: typeof entry.launchedAt === 'number' ? entry.launchedAt : null,
    }))
    .filter((entry) => entry.evidenceKey.length > 0);

  return {
    archivePath: resolved.archivePath,
    archiveRelativePath: STUDIO_TEST_EVIDENCE_ARCHIVE_PATH.split(path.sep).join('/'),
    entryCount: normalizedEntries.length,
    commands: normalizeStringArray(normalizedEntries.map((entry) => entry.command)),
    projectIds: normalizeStringArray(normalizedEntries.map((entry) => entry.projectId)),
    latestLaunchedAt: normalizedEntries.reduce((latest, entry) => {
      if (typeof entry.launchedAt !== 'number') {
        return latest;
      }

      return latest === null || entry.launchedAt > latest ? entry.launchedAt : latest;
    }, null),
  };
}
