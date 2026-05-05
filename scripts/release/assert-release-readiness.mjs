#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_RELEASE_PROFILE_ID,
  resolveReleaseProfile,
} from './release-profiles.mjs';
import {
  assertClearStopShipEvidence,
} from './release-stop-ship-governance.mjs';

const __filename = fileURLToPath(import.meta.url);

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function normalizeStringArray(values) {
  return Array.isArray(values)
    ? values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
    : [];
}

function buildRequiredReleaseCoverage(profile) {
  const requiredTargets = ['web/web/any'];

  for (const entry of profile.desktop?.matrix ?? []) {
    for (const bundle of entry.bundles ?? []) {
      requiredTargets.push(`desktop/${entry.platform}/${entry.arch}/${bundle}`);
    }
  }

  for (const entry of profile.server?.matrix ?? []) {
    requiredTargets.push(`server/${entry.platform}/${entry.arch}`);
  }

  for (const entry of profile.container?.matrix ?? []) {
    requiredTargets.push(`container/${entry.platform}/${entry.arch}/${entry.accelerator}`);
  }

  for (const entry of profile.kubernetes?.matrix ?? []) {
    requiredTargets.push(`kubernetes/${entry.platform}/${entry.arch}/${entry.accelerator}`);
  }

  return requiredTargets.sort((left, right) => left.localeCompare(right));
}

function computeSha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function readJsonFile(filePath, contextLabel) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Unable to parse ${contextLabel}: ${filePath}. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function readChecksumManifest(checksumPath) {
  const entries = new Map();
  const lines = readFileSync(checksumPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})\s{2}(.+)$/i);
    if (!match) {
      throw new Error(`Invalid checksum manifest line in ${checksumPath}: ${line}`);
    }

    const [, checksum, relativePath] = match;
    const normalizedRelativePath = String(relativePath ?? '').trim().replaceAll('\\', '/');
    if (!normalizedRelativePath) {
      throw new Error(`Invalid checksum manifest artifact path in ${checksumPath}: ${line}`);
    }
    if (entries.has(normalizedRelativePath)) {
      throw new Error(`Duplicate checksum manifest entry for ${normalizedRelativePath} in ${checksumPath}`);
    }

    entries.set(normalizedRelativePath, String(checksum).toLowerCase());
  }

  return entries;
}

function readSingleFileChecksumSidecar({
  sidecarPath,
  expectedFileName,
  label,
}) {
  const lines = readFileSync(sidecarPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length !== 1) {
    throw new Error(`${label} must contain exactly one checksum entry: ${sidecarPath}`);
  }

  const match = lines[0].match(/^([a-f0-9]{64})\s{2}(.+)$/i);
  if (!match) {
    throw new Error(`Invalid ${label} line in ${sidecarPath}: ${lines[0]}`);
  }

  const [, checksum, fileName] = match;
  if (fileName !== expectedFileName) {
    throw new Error(
      `${label} must reference ${expectedFileName}, received ${fileName || 'missing'}.`,
    );
  }

  return String(checksum).toLowerCase();
}

function assertReleaseTopLevelFileName(fileName, label) {
  if (
    !fileName
    || fileName === '.'
    || fileName === '..'
    || fileName.includes('\0')
    || fileName.includes(':')
    || fileName.includes('/')
    || fileName.includes('\\')
    || path.posix.isAbsolute(fileName)
    || path.win32.isAbsolute(fileName)
    || path.posix.basename(fileName) !== fileName
    || path.win32.basename(fileName) !== fileName
  ) {
    throw new Error(`Invalid ${label}: ${fileName || 'missing'}`);
  }
}

function assertReleaseManifestChecksumSidecar({
  manifestPath,
  manifestFileName,
  manifestChecksumPath,
}) {
  if (!existsSync(manifestChecksumPath)) {
    throw new Error(`Missing finalized release manifest checksum sidecar: ${manifestChecksumPath}`);
  }

  const manifestChecksumStat = statSync(manifestChecksumPath);
  if (!manifestChecksumStat.isFile()) {
    throw new Error(
      `Finalized release manifest checksum sidecar is not a file: ${manifestChecksumPath}`,
    );
  }

  const expectedSha256 = readSingleFileChecksumSidecar({
    sidecarPath: manifestChecksumPath,
    expectedFileName: manifestFileName,
    label: 'Release manifest checksum sidecar',
  });
  const actualSha256 = computeSha256(manifestPath);

  if (expectedSha256 !== actualSha256) {
    throw new Error(
      `Release manifest checksum sidecar mismatch: sidecar=${expectedSha256} actual=${actualSha256}.`,
    );
  }
}

function assertReleaseCoverageReady({
  manifest,
  profile,
}) {
  const coverage = manifest?.releaseCoverage;
  if (!coverage || typeof coverage !== 'object' || Array.isArray(coverage)) {
    throw new Error('Release manifest is missing releaseCoverage.');
  }

  const profileRequiredTargets = buildRequiredReleaseCoverage(profile);
  const requiredTargets = normalizeStringArray(coverage.requiredTargets);
  const presentTargets = normalizeStringArray(coverage.presentTargets);
  const missingTargets = normalizeStringArray(coverage.missingTargets);

  if (
    profileRequiredTargets.length !== requiredTargets.length
    || profileRequiredTargets.some((target, index) => target !== requiredTargets[index])
  ) {
    throw new Error(
      'Release manifest coverage does not match profile: releaseCoverage.requiredTargets must exactly match the active release profile.',
    );
  }

  if (String(coverage.status ?? '').trim() !== 'complete') {
    throw new Error(
      `Release manifest is not publish-ready: releaseCoverage.status=${coverage.status ?? 'unknown'}. Missing targets: ${missingTargets.join(', ') || 'unknown'}`,
    );
  }

  if (Boolean(coverage.allowPartialRelease)) {
    throw new Error(
      'Release manifest was finalized with --allow-partial-release and must not be published.',
    );
  }

  if (requiredTargets.length === 0) {
    throw new Error('Release manifest releaseCoverage.requiredTargets must not be empty.');
  }

  if (missingTargets.length > 0) {
    throw new Error(
      `Release manifest is not publish-ready: releaseCoverage.missingTargets is not empty (${missingTargets.join(', ')}).`,
    );
  }

  if (
    requiredTargets.length !== presentTargets.length
    || requiredTargets.some((target, index) => target !== presentTargets[index])
  ) {
    throw new Error(
      'Release manifest is not publish-ready: releaseCoverage.presentTargets must exactly match requiredTargets.',
    );
  }

  return {
    requiredTargets,
    presentTargets,
    missingTargets,
  };
}

function assertManifestIdentity({
  manifest,
  profile,
}) {
  const manifestProfileId = String(manifest?.profileId ?? '').trim();
  if (manifestProfileId !== profile.id) {
    throw new Error(
      `Release manifest profile mismatch: expected ${profile.id}, received ${manifestProfileId || 'missing'}.`,
    );
  }

  const checksumFileName = String(manifest?.checksumFileName ?? '').trim();
  if (checksumFileName !== profile.release.globalChecksumsFileName) {
    throw new Error(
      `Release manifest checksum file mismatch: expected ${profile.release.globalChecksumsFileName}, received ${checksumFileName || 'missing'}.`,
    );
  }

  return {
    checksumFileName,
  };
}

function assertArtifactReady({
  releaseAssetsDir,
  artifact,
  checksumEntries,
}) {
  const relativePath = String(artifact?.relativePath ?? '').trim().replaceAll('\\', '/');
  if (!relativePath) {
    throw new Error('Release manifest contains an artifact without relativePath.');
  }
  if (
    path.posix.isAbsolute(relativePath)
    || path.win32.isAbsolute(relativePath)
    || relativePath.split('/').includes('..')
  ) {
    throw new Error(`Release manifest contains an unsafe artifact path: ${relativePath}`);
  }

  const artifactPath = path.join(releaseAssetsDir, relativePath);
  if (!existsSync(artifactPath)) {
    throw new Error(`Missing release artifact: ${relativePath}`);
  }

  const artifactStat = statSync(artifactPath);
  if (!artifactStat.isFile()) {
    throw new Error(`Release artifact is not a file: ${relativePath}`);
  }

  const actualSha256 = computeSha256(artifactPath);
  const expectedSha256 = String(artifact?.sha256 ?? '').trim().toLowerCase();
  if (expectedSha256 !== actualSha256) {
    throw new Error(
      `Artifact checksum mismatch for ${relativePath}: manifest=${expectedSha256 || 'missing'} actual=${actualSha256}`,
    );
  }

  const checksumManifestSha256 = checksumEntries.get(relativePath);
  if (checksumManifestSha256 !== actualSha256) {
    throw new Error(
      `Checksum manifest mismatch for ${relativePath}: checksumFile=${checksumManifestSha256 ?? 'missing'} actual=${actualSha256}`,
    );
  }

  if (Number(artifact?.size) !== artifactStat.size) {
    throw new Error(
      `Artifact size mismatch for ${relativePath}: manifest=${artifact?.size ?? 'missing'} actual=${artifactStat.size}`,
    );
  }
}

function readReleaseAttestationEvidence({
  releaseAssetsDir,
  profile,
}) {
  assertReleaseTopLevelFileName(
    profile.release.attestationEvidenceFileName,
    'release attestation evidence file name',
  );
  const attestationEvidencePath = path.join(
    releaseAssetsDir,
    profile.release.attestationEvidenceFileName,
  );
  if (!existsSync(attestationEvidencePath)) {
    throw new Error(`Missing release attestation evidence: ${attestationEvidencePath}`);
  }

  const evidenceStat = statSync(attestationEvidencePath);
  if (!evidenceStat.isFile()) {
    throw new Error(`Release attestation evidence is not a file: ${attestationEvidencePath}`);
  }

  return {
    attestationEvidencePath,
    evidence: readJsonFile(attestationEvidencePath, 'release attestation evidence'),
  };
}

function normalizeReleaseRelativePath(value) {
  return String(value ?? '').trim().replaceAll('\\', '/');
}

function normalizeAttestationArtifactEntries(evidence) {
  return Array.isArray(evidence?.artifacts)
    ? evidence.artifacts
      .map((entry) => ({
        ...entry,
        relativePath: normalizeReleaseRelativePath(entry?.relativePath),
      }))
      .filter((entry) => entry.relativePath.length > 0)
    : [];
}

function assertReleaseAttestationEvidenceReady({
  releaseAssetsDir,
  manifest,
  artifacts,
  profile,
}) {
  const attestationRequired = Boolean(
    profile.release.enableArtifactAttestations
      || manifest?.attestationEnabled,
  );
  if (!attestationRequired) {
    return null;
  }

  const { attestationEvidencePath, evidence } = readReleaseAttestationEvidence({
    releaseAssetsDir,
    profile,
  });
  const manifestRepository = String(manifest?.repository ?? '').trim();
  const manifestReleaseTag = String(manifest?.releaseTag ?? '').trim();
  const expectedSourceRef = manifestReleaseTag ? `refs/tags/${manifestReleaseTag}` : '';
  const expectedPredicateType = String(
    profile.release.attestationPredicateType ?? manifest?.attestationPredicateType ?? '',
  ).trim();
  const expectedSignerWorkflow = String(profile.release.attestationSignerWorkflowPath ?? '').trim();

  if (String(evidence?.repository ?? '').trim() !== manifestRepository) {
    throw new Error(
      `Release attestation evidence repository mismatch: expected ${manifestRepository || 'missing'}, received ${String(evidence?.repository ?? '').trim() || 'missing'}.`,
    );
  }
  if (String(evidence?.releaseTag ?? '').trim() !== manifestReleaseTag) {
    throw new Error(
      `Release attestation evidence release tag mismatch: expected ${manifestReleaseTag || 'missing'}, received ${String(evidence?.releaseTag ?? '').trim() || 'missing'}.`,
    );
  }
  if (String(evidence?.predicateType ?? '').trim() !== expectedPredicateType) {
    throw new Error(
      `Release attestation evidence predicate type mismatch: expected ${expectedPredicateType || 'missing'}, received ${String(evidence?.predicateType ?? '').trim() || 'missing'}.`,
    );
  }
  if (
    expectedSignerWorkflow
    && String(evidence?.signerWorkflow ?? '').trim() !== expectedSignerWorkflow
  ) {
    throw new Error(
      `Release attestation evidence signer workflow mismatch: expected ${expectedSignerWorkflow}, received ${String(evidence?.signerWorkflow ?? '').trim() || 'missing'}.`,
    );
  }

  const evidenceByRelativePath = new Map();
  for (const entry of normalizeAttestationArtifactEntries(evidence)) {
    const relativePath = entry.relativePath;
    if (
      path.posix.isAbsolute(relativePath)
      || path.win32.isAbsolute(relativePath)
      || relativePath.split('/').includes('..')
    ) {
      throw new Error(`Release attestation evidence contains an unsafe artifact path: ${relativePath}`);
    }
    if (evidenceByRelativePath.has(relativePath)) {
      throw new Error(
        `Release attestation evidence contains duplicate artifact verification for ${relativePath}.`,
      );
    }
    evidenceByRelativePath.set(relativePath, entry);
  }

  for (const artifact of artifacts) {
    const relativePath = normalizeReleaseRelativePath(artifact?.relativePath);
    const evidenceEntry = evidenceByRelativePath.get(relativePath);
    if (!evidenceEntry) {
      throw new Error(
        `Release attestation evidence is missing artifact verification for ${relativePath}.`,
      );
    }

    const expectedSha256 = String(artifact?.sha256 ?? '').trim().toLowerCase();
    const actualSha256 = String(evidenceEntry?.sha256 ?? '').trim().toLowerCase();
    if (actualSha256 !== expectedSha256) {
      throw new Error(
        `Release attestation evidence digest mismatch for ${relativePath}: evidence=${actualSha256 || 'missing'} manifest=${expectedSha256 || 'missing'}.`,
      );
    }
    if (String(evidenceEntry?.repository ?? '').trim() !== manifestRepository) {
      throw new Error(
        `Release attestation evidence repository mismatch for ${relativePath}: expected ${manifestRepository || 'missing'}, received ${String(evidenceEntry?.repository ?? '').trim() || 'missing'}.`,
      );
    }
    if (String(evidenceEntry?.releaseTag ?? '').trim() !== manifestReleaseTag) {
      throw new Error(
        `Release attestation evidence release tag mismatch for ${relativePath}: expected ${manifestReleaseTag || 'missing'}, received ${String(evidenceEntry?.releaseTag ?? '').trim() || 'missing'}.`,
      );
    }
    if (expectedSourceRef && String(evidenceEntry?.sourceRef ?? '').trim() !== expectedSourceRef) {
      throw new Error(
        `Release attestation evidence source ref mismatch for ${relativePath}: expected ${expectedSourceRef}, received ${String(evidenceEntry?.sourceRef ?? '').trim() || 'missing'}.`,
      );
    }
    if (String(evidenceEntry?.predicateType ?? '').trim() !== expectedPredicateType) {
      throw new Error(
        `Release attestation evidence predicate type mismatch for ${relativePath}: expected ${expectedPredicateType || 'missing'}, received ${String(evidenceEntry?.predicateType ?? '').trim() || 'missing'}.`,
      );
    }
    if (
      expectedSignerWorkflow
      && String(evidenceEntry?.signerWorkflow ?? '').trim() !== expectedSignerWorkflow
    ) {
      throw new Error(
        `Release attestation evidence signer workflow mismatch for ${relativePath}: expected ${expectedSignerWorkflow}, received ${String(evidenceEntry?.signerWorkflow ?? '').trim() || 'missing'}.`,
      );
    }
    if (evidenceEntry?.verified !== true) {
      throw new Error(
        `Release attestation evidence must be verified for ${relativePath}.`,
      );
    }
    if (!String(evidenceEntry?.verifiedAt ?? '').trim()) {
      throw new Error(`Release attestation evidence for ${relativePath} is missing verifiedAt.`);
    }
    const verificationCommand = String(evidenceEntry?.verificationCommand ?? '').trim();
    if (!verificationCommand.includes('gh attestation verify')) {
      throw new Error(
        `Release attestation evidence for ${relativePath} must record the gh attestation verify command.`,
      );
    }
  }

  return {
    attestationEvidencePath,
  };
}

export function parseArgs(argv) {
  const options = {
    profileId: DEFAULT_RELEASE_PROFILE_ID,
    releaseAssetsDir: path.resolve('release-assets'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--profile') {
      options.profileId = readOptionValue(argv, index, '--profile');
      index += 1;
      continue;
    }

    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = path.resolve(
        readOptionValue(argv, index, '--release-assets-dir'),
      );
      index += 1;
    }
  }

  return options;
}

export function assertReleaseReadiness({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  releaseAssetsDir = path.resolve('release-assets'),
  resolveReleaseProfileFn = resolveReleaseProfile,
} = {}) {
  const profile = resolveReleaseProfileFn(profileId);
  const normalizedReleaseAssetsDir = path.resolve(releaseAssetsDir);

  if (!existsSync(normalizedReleaseAssetsDir)) {
    throw new Error(`Missing release assets directory: ${normalizedReleaseAssetsDir}`);
  }

  const manifestPath = path.join(
    normalizedReleaseAssetsDir,
    profile.release.manifestFileName,
  );
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing finalized release manifest: ${manifestPath}`);
  }
  assertReleaseTopLevelFileName(
    profile.release.manifestChecksumFileName,
    'release manifest checksum sidecar file name',
  );
  const manifestChecksumPath = path.join(
    normalizedReleaseAssetsDir,
    profile.release.manifestChecksumFileName,
  );
  assertReleaseManifestChecksumSidecar({
    manifestPath,
    manifestFileName: profile.release.manifestFileName,
    manifestChecksumPath,
  });

  const manifest = readJsonFile(manifestPath, 'finalized release manifest');
  const manifestIdentity = assertManifestIdentity({
    manifest,
    profile,
  });
  const coverage = assertReleaseCoverageReady({
    manifest,
    profile,
  });
  const checksumFileName = manifestIdentity.checksumFileName;
  if (!checksumFileName || path.isAbsolute(checksumFileName) || checksumFileName.includes('/') || checksumFileName.includes('\\')) {
    throw new Error(`Invalid release checksum file name: ${checksumFileName || 'missing'}`);
  }

  const checksumPath = path.join(normalizedReleaseAssetsDir, checksumFileName);
  if (!existsSync(checksumPath)) {
    throw new Error(`Missing finalized release checksum manifest: ${checksumPath}`);
  }
  const checksumEntries = readChecksumManifest(checksumPath);

  const artifacts = Array.isArray(manifest?.artifacts) ? manifest.artifacts : [];
  if (artifacts.length === 0) {
    throw new Error('Release manifest artifacts must not be empty.');
  }

  const artifactPaths = new Set();
  for (const artifact of artifacts) {
    const relativePath = String(artifact?.relativePath ?? '').trim().replaceAll('\\', '/');
    if (artifactPaths.has(relativePath)) {
      throw new Error(`Release manifest contains duplicate artifact path: ${relativePath}`);
    }
    artifactPaths.add(relativePath);
    assertArtifactReady({
      releaseAssetsDir: normalizedReleaseAssetsDir,
      artifact,
      checksumEntries,
    });
  }

  for (const checksumRelativePath of checksumEntries.keys()) {
    if (!artifactPaths.has(checksumRelativePath)) {
      throw new Error(
        `Checksum manifest contains an artifact not listed in release-manifest.json: ${checksumRelativePath}`,
      );
    }
  }

  assertClearStopShipEvidence({
    releaseControl: manifest.releaseControl,
    qualityEvidence: manifest.qualityEvidence,
    assets: Array.isArray(manifest.assets) ? manifest.assets : [],
    artifacts,
    errorPrefix: 'Formal or general-availability release readiness requires clear stop-ship evidence',
  });
  const attestationEvidence = assertReleaseAttestationEvidenceReady({
    releaseAssetsDir: normalizedReleaseAssetsDir,
    manifest,
    artifacts,
    profile,
  });

  return {
    releaseAssetsDir: normalizedReleaseAssetsDir,
    manifestPath,
    manifestChecksumPath,
    attestationEvidencePath: attestationEvidence?.attestationEvidencePath ?? '',
    checksumPath,
    artifactCount: artifacts.length,
    requiredTargetCount: coverage.requiredTargets.length,
  };
}

function main() {
  const result = assertReleaseReadiness(parseArgs(process.argv.slice(2)));
  process.stdout.write(
    [
      'Release readiness assertion passed.',
      `releaseAssetsDir=${result.releaseAssetsDir}`,
      `manifest=${result.manifestPath}`,
      `manifestChecksum=${result.manifestChecksumPath}`,
      `attestationEvidence=${result.attestationEvidencePath}`,
      `checksumManifest=${result.checksumPath}`,
      `artifactCount=${result.artifactCount}`,
      `requiredTargetCount=${result.requiredTargetCount}`,
    ].join('\n'),
  );
  process.stdout.write('\n');
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
