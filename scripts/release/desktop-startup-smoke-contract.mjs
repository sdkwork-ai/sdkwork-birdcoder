import fs from 'node:fs';
import path from 'node:path';

export const DESKTOP_STARTUP_SMOKE_REPORT_FILENAME = 'desktop-startup-smoke-report.json';
export const DESKTOP_STARTUP_EVIDENCE_FILENAME = 'desktop-startup-evidence.json';

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

function normalizeArch(arch) {
  return String(arch ?? '').trim().toLowerCase();
}

function normalizeStringArray(values) {
  return Array.isArray(values)
    ? values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
    : [];
}

function normalizeChecks(values) {
  return Array.isArray(values)
    ? values
      .map((value) => ({
        id: String(value?.id ?? '').trim(),
        status: String(value?.status ?? '').trim().toLowerCase(),
        detail: String(value?.detail ?? '').trim(),
      }))
      .filter((value) => value.id.length > 0)
    : [];
}

export function resolveDesktopStartupSmokeReportPath({
  releaseAssetsDir,
  platform,
  arch,
} = {}) {
  return path.join(
    releaseAssetsDir,
    'desktop',
    normalizePlatform(platform),
    normalizeArch(arch),
    DESKTOP_STARTUP_SMOKE_REPORT_FILENAME,
  );
}

export function resolveDesktopStartupEvidencePath({
  releaseAssetsDir,
  platform,
  arch,
} = {}) {
  return path.join(
    releaseAssetsDir,
    'desktop',
    normalizePlatform(platform),
    normalizeArch(arch),
    DESKTOP_STARTUP_EVIDENCE_FILENAME,
  );
}

export function writeDesktopStartupEvidence({
  releaseAssetsDir,
  platform,
  arch,
  target = '',
  manifestPath = '',
  artifactRelativePaths = [],
  status = 'passed',
  phase = 'shell-mounted',
  descriptorBrowserBaseUrl = '',
  builtInInstanceId = 'birdcoder-local',
  builtInInstanceStatus = 'ready',
  readinessEvidence = { ready: true },
  capturedAt = new Date().toISOString(),
} = {}) {
  const capturedEvidencePath = resolveDesktopStartupEvidencePath({
    releaseAssetsDir,
    platform,
    arch,
  });
  const evidence = {
    platform: normalizePlatform(platform),
    arch: normalizeArch(arch),
    target: String(target ?? '').trim(),
    manifestPath: manifestPath ? path.resolve(manifestPath) : '',
    capturedAt: String(capturedAt ?? '').trim() || new Date().toISOString(),
    status: String(status ?? '').trim() || 'passed',
    phase: String(phase ?? '').trim() || 'shell-mounted',
    descriptorBrowserBaseUrl: String(descriptorBrowserBaseUrl ?? '').trim(),
    builtInInstanceId: String(builtInInstanceId ?? '').trim(),
    builtInInstanceStatus: String(builtInInstanceStatus ?? '').trim(),
    readinessEvidence: readinessEvidence && typeof readinessEvidence === 'object' && !Array.isArray(readinessEvidence)
      ? readinessEvidence
      : { ready: true },
    artifactRelativePaths: normalizeStringArray(artifactRelativePaths),
  };

  fs.mkdirSync(path.dirname(capturedEvidencePath), { recursive: true });
  fs.writeFileSync(capturedEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

  return {
    capturedEvidencePath,
    evidence,
  };
}

export function writeDesktopStartupSmokeReport({
  releaseAssetsDir,
  platform,
  arch,
  target = '',
  manifestPath = '',
  artifactRelativePaths = [],
  launcherRelativePath = '',
  status = 'passed',
  phase = 'shell-mounted',
  descriptorBrowserBaseUrl = '',
  builtInInstanceId = 'birdcoder-local',
  builtInInstanceStatus = 'ready',
  capturedEvidenceRelativePath = '',
  checks = [],
  verifiedAt = new Date().toISOString(),
} = {}) {
  const reportPath = resolveDesktopStartupSmokeReportPath({
    releaseAssetsDir,
    platform,
    arch,
  });
  const report = {
    platform: normalizePlatform(platform),
    arch: normalizeArch(arch),
    target: String(target ?? '').trim(),
    manifestPath: manifestPath ? path.resolve(manifestPath) : '',
    verifiedAt: String(verifiedAt ?? '').trim() || new Date().toISOString(),
    status: String(status ?? '').trim() || 'passed',
    phase: String(phase ?? '').trim() || 'shell-mounted',
    descriptorBrowserBaseUrl: String(descriptorBrowserBaseUrl ?? '').trim(),
    builtInInstanceId: String(builtInInstanceId ?? '').trim(),
    builtInInstanceStatus: String(builtInInstanceStatus ?? '').trim(),
    launcherRelativePath: String(launcherRelativePath ?? '').trim(),
    capturedEvidenceRelativePath: String(capturedEvidenceRelativePath ?? '').trim(),
    artifactRelativePaths: normalizeStringArray(artifactRelativePaths),
    checks: normalizeChecks(checks),
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return {
    reportPath,
    report,
  };
}
