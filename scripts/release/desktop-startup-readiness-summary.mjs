function normalizeStringArray(values) {
  return Array.from(new Set(
    (values ?? [])
      .map((value) => String(value ?? '').trim())
      .filter(Boolean),
  )).sort((left, right) => left.localeCompare(right));
}

function summarizeTruthyChecks(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return [];
  }

  return normalizeStringArray(
    Object.entries(record)
      .filter((entry) => entry[1] === true)
      .map((entry) => entry[0]),
  );
}

function areAllChecksReady(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return false;
  }

  const entries = Object.entries(record).filter((entry) => typeof entry[1] === 'boolean');
  return entries.length > 0 && entries.every((entry) => entry[1] === true);
}

export function resolveDesktopAssetTargetLabel(entry = {}) {
  const parts = [
    entry.platform,
    entry.arch,
    entry.accelerator,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);

  return parts.length > 0 ? parts.join('/') : 'desktop';
}

export function normalizeDesktopStartupReadinessSummary(summary = {}) {
  return {
    ready: summary?.ready === true,
    shellMounted: summary?.shellMounted === true,
    workspaceBootstrapReady: summary?.workspaceBootstrapReady === true,
    localProjectRecoveryReady: summary?.localProjectRecoveryReady === true,
    workspaceBootstrapChecks: normalizeStringArray(summary?.workspaceBootstrapChecks ?? []),
    localProjectRecoveryChecks: normalizeStringArray(summary?.localProjectRecoveryChecks ?? []),
  };
}

export function summarizeDesktopStartupReadiness(readinessEvidence) {
  if (!readinessEvidence || typeof readinessEvidence !== 'object' || Array.isArray(readinessEvidence)) {
    return null;
  }

  return {
    ready: readinessEvidence.ready === true,
    shellMounted: readinessEvidence.shellMounted === true,
    workspaceBootstrapReady: areAllChecksReady(readinessEvidence.workspaceBootstrap),
    localProjectRecoveryReady: areAllChecksReady(readinessEvidence.localProjectRecovery),
    workspaceBootstrapChecks: summarizeTruthyChecks(readinessEvidence.workspaceBootstrap),
    localProjectRecoveryChecks: summarizeTruthyChecks(readinessEvidence.localProjectRecovery),
  };
}

export function collectDesktopStartupReadinessSignals(assets = []) {
  const desktopAssets = Array.isArray(assets)
    ? assets.filter((entry) => String(entry?.family ?? '').trim() === 'desktop')
    : [];

  return normalizeStringArray(
    desktopAssets.flatMap((entry) => {
      const targetLabel = resolveDesktopAssetTargetLabel(entry);
      if (!entry?.desktopStartupReadinessSummary) {
        return [`desktop startup readiness summary missing \`${targetLabel}\``];
      }

      const summary = normalizeDesktopStartupReadinessSummary(entry.desktopStartupReadinessSummary);
      const signals = [];

      if (!summary.shellMounted) {
        signals.push(`desktop shell mount \`${targetLabel}\` is \`not-confirmed\``);
      }
      if (!summary.workspaceBootstrapReady) {
        signals.push(`desktop workspace bootstrap \`${targetLabel}\` is \`not-ready\``);
      }
      if (!summary.localProjectRecoveryReady) {
        signals.push(`desktop local project recovery \`${targetLabel}\` is \`not-ready\``);
      }
      if (!summary.ready && signals.length === 0) {
        signals.push(`desktop startup readiness \`${targetLabel}\` is \`not-ready\``);
      }

      return signals;
    }),
  );
}
