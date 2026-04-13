import fs from 'node:fs';
import path from 'node:path';

export const RELEASE_SMOKE_REPORT_FILENAME = 'release-smoke-report.json';

const SUPPORTED_FAMILIES = new Set([
  'server',
  'container',
  'kubernetes',
  'web',
]);

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

function normalizeFamily(family) {
  const normalizedFamily = String(family ?? '').trim().toLowerCase();
  if (!SUPPORTED_FAMILIES.has(normalizedFamily)) {
    throw new Error(`Unsupported release smoke family: ${family}`);
  }

  return normalizedFamily;
}

function normalizeAccelerator(family, accelerator = '') {
  const normalizedFamily = normalizeFamily(family);
  if (normalizedFamily === 'server' || normalizedFamily === 'web') {
    return '';
  }

  return String(accelerator ?? '').trim().toLowerCase() || 'cpu';
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

export function resolveReleaseSmokeReportPath({
  releaseAssetsDir,
  family,
  platform,
  arch,
  accelerator = '',
} = {}) {
  const normalizedFamily = normalizeFamily(family);
  if (normalizedFamily === 'server') {
    return path.join(
      releaseAssetsDir,
      normalizedFamily,
      normalizePlatform(platform),
      normalizeArch(arch),
      RELEASE_SMOKE_REPORT_FILENAME,
    );
  }
  if (normalizedFamily === 'web') {
    return path.join(
      releaseAssetsDir,
      normalizedFamily,
      RELEASE_SMOKE_REPORT_FILENAME,
    );
  }

  return path.join(
    releaseAssetsDir,
    normalizedFamily,
    normalizePlatform(platform),
    normalizeArch(arch),
    normalizeAccelerator(normalizedFamily, accelerator),
    RELEASE_SMOKE_REPORT_FILENAME,
  );
}

export function writeReleaseSmokeReport({
  releaseAssetsDir,
  family,
  platform,
  arch,
  accelerator = '',
  target = '',
  smokeKind = '',
  status = 'passed',
  manifestPath = '',
  artifactRelativePaths = [],
  launcherRelativePath = '',
  runtimeBaseUrl = '',
  checks = [],
  capabilities = undefined,
  skippedReason = '',
  verifiedAt = new Date().toISOString(),
} = {}) {
  const normalizedFamily = normalizeFamily(family);
  const normalizedPlatform = normalizePlatform(platform);
  const normalizedArch = normalizeArch(arch);
  const normalizedAccelerator = normalizeAccelerator(normalizedFamily, accelerator);
  const reportPath = resolveReleaseSmokeReportPath({
    releaseAssetsDir,
    family: normalizedFamily,
    platform: normalizedPlatform,
    arch: normalizedArch,
    accelerator: normalizedAccelerator,
  });
  const report = {
    family: normalizedFamily,
    platform: normalizedPlatform,
    arch: normalizedArch,
    target: String(target ?? '').trim(),
    smokeKind: String(smokeKind ?? '').trim(),
    status: String(status ?? '').trim().toLowerCase() || 'passed',
    verifiedAt: String(verifiedAt ?? '').trim() || new Date().toISOString(),
    manifestPath: manifestPath ? path.resolve(manifestPath) : '',
    artifactRelativePaths: normalizeStringArray(artifactRelativePaths),
    launcherRelativePath: String(launcherRelativePath ?? '').trim(),
    runtimeBaseUrl: String(runtimeBaseUrl ?? '').trim(),
    checks: normalizeChecks(checks),
  };

  if (normalizedFamily !== 'server' && normalizedFamily !== 'web') {
    report.accelerator = normalizedAccelerator;
  }
  if (typeof capabilities === 'object' && capabilities && !Array.isArray(capabilities)) {
    report.capabilities = capabilities;
  }
  if (String(skippedReason ?? '').trim()) {
    report.skippedReason = String(skippedReason).trim();
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return {
    reportPath,
    report,
  };
}

export function readReleaseSmokeReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    throw new Error(`Missing release smoke report: ${reportPath}`);
  }

  return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
}
