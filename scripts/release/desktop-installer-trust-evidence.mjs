const WINDOWS_BUNDLES = new Set(['nsis', 'msi', 'squirrel']);
const MACOS_BUNDLES = new Set(['app', 'dmg']);
const LINUX_BUNDLES = new Set(['deb', 'rpm', 'appimage']);

function normalizeString(value) {
  return String(value ?? '').trim();
}

function normalizeToken(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  return normalizeToken(value) === 'true';
}

export function resolveDesktopInstallerSignatureScheme({
  platform = '',
  bundle = '',
} = {}) {
  const normalizedPlatform = normalizeToken(platform);
  const normalizedBundle = normalizeToken(bundle);

  if (
    normalizedPlatform === 'windows'
    || normalizedPlatform === 'win32'
    || WINDOWS_BUNDLES.has(normalizedBundle)
  ) {
    return 'windows-authenticode';
  }

  if (
    normalizedPlatform === 'macos'
    || normalizedPlatform === 'darwin'
    || MACOS_BUNDLES.has(normalizedBundle)
  ) {
    return 'macos-codesign-notarization';
  }

  if (
    normalizedPlatform === 'linux'
    || LINUX_BUNDLES.has(normalizedBundle)
  ) {
    return 'linux-package-metadata';
  }

  return 'native-installer-attestation';
}

export function createPendingDesktopInstallerSignatureEvidence({
  platform = '',
  bundle = '',
} = {}) {
  return {
    status: 'pending',
    required: true,
    scheme: resolveDesktopInstallerSignatureScheme({ platform, bundle }),
    verifiedAt: '',
    subject: '',
    issuer: '',
    timestamped: false,
    notarized: false,
    stapled: false,
    packageMetadataVerified: false,
  };
}

export function normalizeDesktopInstallerSignatureEvidence(evidence = null) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return null;
  }

  return {
    status: normalizeToken(evidence.status),
    required: normalizeBoolean(evidence.required),
    scheme: normalizeToken(evidence.scheme),
    verifiedAt: normalizeString(evidence.verifiedAt),
    subject: normalizeString(evidence.subject),
    issuer: normalizeString(evidence.issuer),
    timestamped: normalizeBoolean(evidence.timestamped),
    notarized: normalizeBoolean(evidence.notarized),
    stapled: normalizeBoolean(evidence.stapled),
    packageMetadataVerified: normalizeBoolean(evidence.packageMetadataVerified),
  };
}

export function normalizeDesktopInstallerTrustSummary(summary = null) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return null;
  }

  const installers = Array.isArray(summary.installers)
    ? summary.installers
      .map((installer) => {
        const relativePath = normalizeString(installer?.relativePath).replaceAll('\\', '/');
        if (!relativePath) {
          return null;
        }

        return {
          relativePath,
          bundle: normalizeToken(installer?.bundle),
          installerFormat: normalizeToken(installer?.installerFormat),
          target: normalizeString(installer?.target),
          signatureEvidence: normalizeDesktopInstallerSignatureEvidence(installer?.signatureEvidence),
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
    : [];

  const rawInstallerCount = Number(summary.installerCount);
  return {
    reportRelativePath: normalizeString(summary.reportRelativePath).replaceAll('\\', '/'),
    manifestRelativePath: normalizeString(summary.manifestRelativePath).replaceAll('\\', '/'),
    status: normalizeToken(summary.status),
    platform: normalizeToken(summary.platform),
    arch: normalizeToken(summary.arch),
    target: normalizeString(summary.target),
    verifiedAt: normalizeString(summary.verifiedAt),
    installerCount: Number.isInteger(rawInstallerCount) && rawInstallerCount >= 0
      ? rawInstallerCount
      : installers.length,
    installers,
  };
}

export function assertDesktopInstallerSignatureEvidence({
  artifact,
  manifestPath = '',
  relativePath = '',
} = {}) {
  const signatureEvidence = normalizeDesktopInstallerSignatureEvidence(
    artifact?.signatureEvidence,
  );
  if (
    !signatureEvidence
    || !signatureEvidence.status
    || signatureEvidence.required !== true
    || !signatureEvidence.scheme
  ) {
    throw new Error(
      `Desktop installer manifest artifact must declare signatureEvidence.status, signatureEvidence.required=true, and signatureEvidence.scheme: ${relativePath} in ${manifestPath}.`,
    );
  }

  return signatureEvidence;
}

function isDesktopInstallerArtifact(artifact = {}) {
  return normalizeToken(artifact.kind) === 'installer';
}

function collectAssetInstallerArtifacts(asset = {}) {
  return (asset?.artifacts ?? [])
    .filter((artifact) => isDesktopInstallerArtifact(artifact))
    .map((artifact) => ({
      ...artifact,
      relativePath: normalizeString(artifact?.relativePath).replaceAll('\\', '/'),
    }))
    .filter((artifact) => artifact.relativePath)
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function collectInstallerArtifacts({
  assets = [],
  artifacts = [],
} = {}) {
  const collectedArtifacts = [];
  const seenRelativePaths = new Set();

  const addArtifact = (artifact) => {
    if (!isDesktopInstallerArtifact(artifact)) {
      return;
    }

    const relativePath = normalizeString(artifact?.relativePath).replaceAll('\\', '/');
    if (!relativePath || seenRelativePaths.has(relativePath)) {
      return;
    }

    seenRelativePaths.add(relativePath);
    collectedArtifacts.push({
      ...artifact,
      relativePath,
    });
  };

  for (const artifact of artifacts ?? []) {
    addArtifact(artifact);
  }

  for (const asset of assets ?? []) {
    for (const artifact of asset?.artifacts ?? []) {
      addArtifact(artifact);
    }
  }

  return collectedArtifacts.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function collectPassedEvidenceGaps({
  relativePath,
  signatureEvidence,
} = {}) {
  const signals = [];
  if (!signatureEvidence.verifiedAt) {
    signals.push(`desktop installer trust evidence \`${relativePath}\` is missing verifiedAt`);
  }

  if (signatureEvidence.scheme === 'windows-authenticode') {
    if (!signatureEvidence.subject) {
      signals.push(`desktop installer trust evidence \`${relativePath}\` is missing subject`);
    }
    if (!signatureEvidence.issuer) {
      signals.push(`desktop installer trust evidence \`${relativePath}\` is missing issuer`);
    }
    if (!signatureEvidence.timestamped) {
      signals.push(`desktop installer trust evidence \`${relativePath}\` is not timestamped`);
    }
    return signals;
  }

  if (signatureEvidence.scheme === 'macos-codesign-notarization') {
    if (!signatureEvidence.subject) {
      signals.push(`desktop installer trust evidence \`${relativePath}\` is missing subject`);
    }
    if (!signatureEvidence.issuer) {
      signals.push(`desktop installer trust evidence \`${relativePath}\` is missing issuer`);
    }
    if (!signatureEvidence.notarized) {
      signals.push(`desktop installer trust evidence \`${relativePath}\` is not notarized`);
    }
    if (!signatureEvidence.stapled) {
      signals.push(`desktop installer trust evidence \`${relativePath}\` is not stapled`);
    }
    return signals;
  }

  if (
    signatureEvidence.scheme === 'linux-package-metadata'
    || signatureEvidence.scheme === 'native-installer-attestation'
  ) {
    if (!signatureEvidence.packageMetadataVerified) {
      signals.push(`desktop installer trust evidence \`${relativePath}\` is missing package metadata verification`);
    }
  }

  return signals;
}

function collectDesktopInstallerTrustSummarySignals({
  asset,
  installers,
} = {}) {
  if (!installers || installers.length === 0) {
    return [];
  }

  const target = `${normalizeToken(asset?.platform)}/${normalizeToken(asset?.arch)}`;
  const summary = normalizeDesktopInstallerTrustSummary(asset?.desktopInstallerTrust);
  if (!summary) {
    return [`desktop installer trust report \`${target}\` is missing`];
  }

  const signals = [];
  if (summary.status !== 'passed') {
    signals.push(`desktop installer trust report \`${target}\` is \`${summary.status || 'missing'}\``);
  }
  if (!summary.reportRelativePath) {
    signals.push(`desktop installer trust report \`${target}\` is missing reportRelativePath`);
  }
  if (!summary.manifestRelativePath) {
    signals.push(`desktop installer trust report \`${target}\` is missing manifestRelativePath`);
  }
  if (!summary.verifiedAt) {
    signals.push(`desktop installer trust report \`${target}\` is missing verifiedAt`);
  }
  if (summary.installerCount !== summary.installers.length) {
    signals.push(`desktop installer trust report \`${target}\` installerCount does not match report installers`);
  }
  if (summary.installerCount !== installers.length) {
    signals.push(`desktop installer trust report \`${target}\` installerCount does not match packaged installers`);
  }

  const summaryInstallersByPath = new Map(
    summary.installers.map((installer) => [installer.relativePath, installer]),
  );
  for (const artifact of installers) {
    if (!summaryInstallersByPath.has(artifact.relativePath)) {
      signals.push(`desktop installer trust report \`${target}\` is missing installer \`${artifact.relativePath}\``);
    }
  }

  for (const installer of summary.installers) {
    const signatureEvidence = normalizeDesktopInstallerSignatureEvidence(installer.signatureEvidence);
    if (!signatureEvidence) {
      signals.push(`desktop installer trust report \`${target}\` installer \`${installer.relativePath}\` is missing signatureEvidence`);
      continue;
    }
    if (signatureEvidence.status !== 'passed') {
      signals.push(`desktop installer trust report \`${target}\` installer \`${installer.relativePath}\` is \`${signatureEvidence.status || 'missing'}\``);
      continue;
    }
    signals.push(...collectPassedEvidenceGaps({
      relativePath: installer.relativePath,
      signatureEvidence,
    }));
  }

  return signals;
}

export function collectDesktopInstallerTrustSignals({
  assets = [],
  artifacts = [],
} = {}) {
  const signals = [];
  for (const asset of assets ?? []) {
    if (normalizeToken(asset?.family) !== 'desktop') {
      continue;
    }

    signals.push(...collectDesktopInstallerTrustSummarySignals({
      asset,
      installers: collectAssetInstallerArtifacts(asset),
    }));
  }

  for (const artifact of collectInstallerArtifacts({ assets, artifacts })) {
    const relativePath = artifact.relativePath;
    const signatureEvidence = normalizeDesktopInstallerSignatureEvidence(
      artifact.signatureEvidence,
    );

    if (!signatureEvidence) {
      signals.push(`desktop installer trust evidence \`${relativePath}\` is missing`);
      continue;
    }

    if (signatureEvidence.required !== true) {
      signals.push(`desktop installer trust evidence \`${relativePath}\` is not required`);
    }
    if (!signatureEvidence.scheme) {
      signals.push(`desktop installer trust evidence \`${relativePath}\` is missing scheme`);
    }
    if (!signatureEvidence.status) {
      signals.push(`desktop installer trust evidence \`${relativePath}\` is missing status`);
      continue;
    }
    if (signatureEvidence.status !== 'passed') {
      signals.push(`desktop installer trust evidence \`${relativePath}\` is \`${signatureEvidence.status}\``);
      continue;
    }

    signals.push(...collectPassedEvidenceGaps({
      relativePath,
      signatureEvidence,
    }));
  }

  return signals;
}
