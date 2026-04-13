import fs from 'node:fs';
import path from 'node:path';

export const TERMINAL_GOVERNANCE_EVIDENCE_ARCHIVE_PATH = path.join(
  'terminal',
  'governance',
  'terminal-governance-diagnostics.json',
);

function normalizeStringArray(values) {
  return Array.from(new Set(
    values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean),
  )).sort((left, right) => left.localeCompare(right));
}

export function resolveTerminalGovernanceEvidenceArchivePath({
  releaseAssetsDir,
} = {}) {
  return path.join(releaseAssetsDir, TERMINAL_GOVERNANCE_EVIDENCE_ARCHIVE_PATH);
}

export function readTerminalGovernanceEvidenceArchive({
  releaseAssetsDir,
} = {}) {
  const archivePath = resolveTerminalGovernanceEvidenceArchivePath({
    releaseAssetsDir,
  });
  if (!fs.existsSync(archivePath)) {
    return null;
  }

  const archive = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
  if (!Array.isArray(archive.records)) {
    throw new Error(`Terminal governance evidence archive records must be an array: ${archivePath}`);
  }

  return {
    archivePath,
    archive,
  };
}

export function summarizeTerminalGovernanceEvidenceArchive({
  releaseAssetsDir,
} = {}) {
  const resolved = readTerminalGovernanceEvidenceArchive({
    releaseAssetsDir,
  });
  if (!resolved) {
    return undefined;
  }

  const normalizedRecords = resolved.archive.records
    .filter((record) => record && typeof record === 'object')
    .map((record) => ({
      traceId: String(record.traceId ?? '').trim(),
      riskLevel: String(record.riskLevel ?? '').trim(),
      approvalPolicy: String(record.approvalPolicy ?? '').trim(),
      recordedAt: typeof record.recordedAt === 'number' ? record.recordedAt : null,
      approvalDecision: String(record.approvalDecision ?? '').trim(),
    }))
    .filter((record) => record.traceId.length > 0);

  return {
    archivePath: resolved.archivePath,
    archiveRelativePath: TERMINAL_GOVERNANCE_EVIDENCE_ARCHIVE_PATH.split(path.sep).join('/'),
    entryCount: normalizedRecords.length,
    blockedRecords: normalizedRecords.filter((record) => record.approvalDecision === 'blocked')
      .length,
    riskLevels: normalizeStringArray(normalizedRecords.map((record) => record.riskLevel)),
    approvalPolicies: normalizeStringArray(
      normalizedRecords.map((record) => record.approvalPolicy),
    ),
    latestRecordedAt: normalizedRecords.reduce((latest, record) => {
      if (typeof record.recordedAt !== 'number') {
        return latest;
      }

      return latest === null || record.recordedAt > latest ? record.recordedAt : latest;
    }, null),
  };
}
