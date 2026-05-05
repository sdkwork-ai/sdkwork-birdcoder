import fs from 'node:fs';
import path from 'node:path';

import {
  normalizeDesktopInstallerSignatureEvidence,
} from './desktop-installer-trust-evidence.mjs';

export const DESKTOP_INSTALLER_SMOKE_REPORT_FILENAME = 'desktop-installer-smoke-report.json';

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

function normalizeInstallPlanSummaries(values) {
  return Array.isArray(values)
    ? values
      .map((value) => {
        const normalizedValue = {
          relativePath: String(value?.relativePath ?? '').trim(),
          format: String(value?.format ?? '').trim(),
          bundle: String(value?.bundle ?? '').trim(),
          target: String(value?.target ?? '').trim(),
          platform: String(value?.platform ?? '').trim(),
          stepCount: Number.isFinite(value?.stepCount) ? value.stepCount : 0,
        };
        const signatureEvidence = normalizeDesktopInstallerSignatureEvidence(
          value?.signatureEvidence,
        );
        if (signatureEvidence) {
          normalizedValue.signatureEvidence = signatureEvidence;
        }

        return normalizedValue;
      })
      .filter((value) => value.relativePath.length > 0)
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
    : [];
}

export function resolveDesktopInstallerSmokeReportPath({
  releaseAssetsDir,
  platform,
  arch,
} = {}) {
  return path.join(
    releaseAssetsDir,
    'desktop',
    normalizePlatform(platform),
    normalizeArch(arch),
    DESKTOP_INSTALLER_SMOKE_REPORT_FILENAME,
  );
}

export function writeDesktopInstallerSmokeReport({
  releaseAssetsDir,
  platform,
  arch,
  target = '',
  manifestPath = '',
  installableArtifactRelativePaths = [],
  requiredCompanionArtifactRelativePaths = [],
  installPlanSummaries = [],
  installReadyLayout = null,
  verifiedAt = new Date().toISOString(),
} = {}) {
  const reportPath = resolveDesktopInstallerSmokeReportPath({
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
    installableArtifactRelativePaths: normalizeStringArray(installableArtifactRelativePaths),
    requiredCompanionArtifactRelativePaths: normalizeStringArray(
      requiredCompanionArtifactRelativePaths,
    ),
    installPlanSummaries: normalizeInstallPlanSummaries(installPlanSummaries),
  };

  if (installReadyLayout && typeof installReadyLayout === 'object' && !Array.isArray(installReadyLayout)) {
    report.installReadyLayout = installReadyLayout;
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return {
    reportPath,
    report,
  };
}
