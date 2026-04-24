import { normalizeQualityEvidenceSummary } from './quality-gate-release-evidence.mjs';
import {
  collectDesktopStartupReadinessSignals,
} from './desktop-startup-readiness-summary.mjs';

function normalizeStringList(values) {
  return Array.from(new Set(
    (values ?? [])
      .map((value) => String(value ?? '').trim())
      .filter(Boolean),
  ));
}

export function normalizeStopShipSignals(values) {
  return normalizeStringList(values);
}

function formatCodeList(values) {
  const normalizedValues = normalizeStringList(values);
  return normalizedValues.map((value) => `\`${value}\``).join(', ');
}

export function collectReleaseStopShipSignals({
  qualityEvidence = null,
  assets = [],
} = {}) {
  const normalizedQualityEvidence = normalizeQualityEvidenceSummary(qualityEvidence ?? {});
  const stopShipSignals = [];

  if (normalizedQualityEvidence.workflowBoundTiers < normalizedQualityEvidence.totalTiers) {
    const missingWorkflowBindings = normalizedQualityEvidence.missingWorkflowBindings.length > 0
      ? ` missing ${formatCodeList(normalizedQualityEvidence.missingWorkflowBindings)}`
      : '';
    stopShipSignals.push(
      `workflow topology drift \`${normalizedQualityEvidence.workflowBoundTiers}/${normalizedQualityEvidence.totalTiers}\`${missingWorkflowBindings}`,
    );
  }

  if (normalizedQualityEvidence.manifestBoundTiers < normalizedQualityEvidence.totalTiers) {
    const missingManifestBindings = normalizedQualityEvidence.missingManifestBindings.length > 0
      ? ` missing ${formatCodeList(normalizedQualityEvidence.missingManifestBindings)}`
      : '';
    stopShipSignals.push(
      `manifest topology drift \`${normalizedQualityEvidence.manifestBoundTiers}/${normalizedQualityEvidence.totalTiers}\`${missingManifestBindings}`,
    );
  }

  if (normalizedQualityEvidence.blockingDiagnosticIds.length > 0) {
    stopShipSignals.push(
      `quality blockers ${formatCodeList(normalizedQualityEvidence.blockingDiagnosticIds)}`,
    );
  }

  if ((normalizedQualityEvidence.executionBlockingTierIds ?? []).length > 0) {
    stopShipSignals.push(
      `runtime blocked tiers ${formatCodeList(normalizedQualityEvidence.executionBlockingTierIds)}`,
    );
  }

  if ((normalizedQualityEvidence.executionFailedTierIds ?? []).length > 0) {
    stopShipSignals.push(
      `runtime failed tiers ${formatCodeList(normalizedQualityEvidence.executionFailedTierIds)}`,
    );
  }

  if ((normalizedQualityEvidence.executionBlockingDiagnosticIds ?? []).length > 0) {
    stopShipSignals.push(
      `runtime blockers ${formatCodeList(normalizedQualityEvidence.executionBlockingDiagnosticIds)}`,
    );
  }

  stopShipSignals.push(...collectDesktopStartupReadinessSignals(assets));

  return stopShipSignals;
}

export function buildPromotionReadinessSummary({
  releaseControl = null,
  stopShipSignals = [],
} = {}) {
  const normalizedStopShipSignals = normalizeStopShipSignals(stopShipSignals);

  return {
    currentReleaseKind: String(releaseControl?.releaseKind ?? '').trim(),
    currentRolloutStage: String(releaseControl?.rolloutStage ?? '').trim(),
    formalOrGaStatus: normalizedStopShipSignals.length > 0 ? 'blocked' : 'clear',
    stopShipSignals: normalizedStopShipSignals,
  };
}

export function normalizePromotionReadinessSummary(summary = {}) {
  return {
    currentReleaseKind: String(summary.currentReleaseKind ?? '').trim(),
    currentRolloutStage: String(summary.currentRolloutStage ?? '').trim(),
    formalOrGaStatus: String(summary.formalOrGaStatus ?? '').trim().toLowerCase() === 'blocked'
      ? 'blocked'
      : 'clear',
    stopShipSignals: normalizeStopShipSignals(summary.stopShipSignals ?? []),
  };
}

export function requiresClearStopShipEvidence({
  releaseControl = null,
  releaseKind = '',
  rolloutStage = '',
} = {}) {
  const normalizedReleaseKind = String(releaseControl?.releaseKind ?? releaseKind ?? '').trim().toLowerCase();
  const normalizedRolloutStage = String(releaseControl?.rolloutStage ?? rolloutStage ?? '').trim().toLowerCase();

  return normalizedReleaseKind === 'formal' || normalizedRolloutStage === 'general-availability';
}

export function assertClearStopShipEvidence({
  releaseControl = null,
  qualityEvidence = null,
  assets = [],
  errorPrefix = 'Formal or general-availability release promotion requires clear stop-ship evidence',
} = {}) {
  if (!requiresClearStopShipEvidence({ releaseControl })) {
    return [];
  }

  const stopShipSignals = collectReleaseStopShipSignals({
    qualityEvidence,
    assets,
  });
  if (stopShipSignals.length > 0) {
    throw new Error(`${errorPrefix}: ${stopShipSignals.join('; ')}`);
  }

  return stopShipSignals;
}
