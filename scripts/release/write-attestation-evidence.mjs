#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  DEFAULT_RELEASE_PROFILE_ID,
  resolveReleaseProfile,
} from './release-profiles.mjs';

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
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

function normalizeReleaseRelativePath(value) {
  return String(value ?? '').trim().replaceAll('\\', '/');
}

function assertSafeReleaseRelativePath(relativePath, label) {
  const normalizedRelativePath = normalizeReleaseRelativePath(relativePath);
  if (!normalizedRelativePath) {
    throw new Error(`${label} is missing.`);
  }
  if (
    path.posix.isAbsolute(normalizedRelativePath)
    || path.win32.isAbsolute(normalizedRelativePath)
    || normalizedRelativePath.split('/').includes('..')
  ) {
    throw new Error(`${label} is unsafe: ${normalizedRelativePath}`);
  }

  return normalizedRelativePath;
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

function normalizeVerificationOutput(rawOutput, relativePath) {
  try {
    return JSON.parse(String(rawOutput ?? '').trim() || 'null');
  } catch (error) {
    throw new Error(
      `Unable to parse gh attestation verification output for ${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function extractSubjectDigestEntries(value) {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const entries = [];
  if (Array.isArray(value.subject)) {
    entries.push(...value.subject);
  }
  if (Array.isArray(value.subjects)) {
    entries.push(...value.subjects);
  }
  if (Array.isArray(value.attestations)) {
    for (const attestation of value.attestations) {
      entries.push(...extractSubjectDigestEntries(attestation));
    }
  }
  if (Array.isArray(value.bundle?.dsseEnvelope?.payload?.subject)) {
    entries.push(...value.bundle.dsseEnvelope.payload.subject);
  }
  if (value.statement && typeof value.statement === 'object') {
    entries.push(...extractSubjectDigestEntries(value.statement));
  }
  if (value.predicate && typeof value.predicate === 'object') {
    entries.push(...extractSubjectDigestEntries(value.predicate));
  }

  return entries;
}

function collectSubjectDigestEntries(verificationOutput) {
  const values = Array.isArray(verificationOutput)
    ? verificationOutput
    : [verificationOutput];
  return values.flatMap((value) => extractSubjectDigestEntries(value));
}

function verificationOutputContainsDigest({
  verificationOutput,
  expectedSha256,
}) {
  return collectSubjectDigestEntries(verificationOutput).some((subject) => {
    const digest = subject?.digest;
    const sha256 = String(
      digest?.sha256
        ?? digest?.['sha256']
        ?? digest?.['sha256:']
        ?? '',
    ).trim().toLowerCase();
    return sha256 === expectedSha256;
  });
}

function buildGhAttestationArgs({
  artifactPath,
  repository,
  sourceRef,
  predicateType,
}) {
  return [
    'attestation',
    'verify',
    artifactPath,
    '-R',
    repository,
    '--source-ref',
    sourceRef,
    '--predicate-type',
    predicateType,
    '--format',
    'json',
  ];
}

function buildVerificationCommand(args) {
  return `gh ${args.map((arg) => String(arg).includes(' ') ? `"${arg}"` : arg).join(' ')}`;
}

export function parseArgs(argv) {
  const options = {
    profileId: DEFAULT_RELEASE_PROFILE_ID,
    releaseAssetsDir: path.resolve('release-assets'),
    repository: '',
    releaseTag: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--profile') {
      options.profileId = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }

    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = path.resolve(readOptionValue(argv, index, token));
      index += 1;
      continue;
    }

    if (token === '--repository') {
      options.repository = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }

    if (token === '--release-tag') {
      options.releaseTag = readOptionValue(argv, index, token);
      index += 1;
    }
  }

  return options;
}

export function writeAttestationEvidence({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  releaseAssetsDir = path.resolve('release-assets'),
  repository = '',
  releaseTag = '',
  now = () => new Date().toISOString(),
  execFileSyncImpl = execFileSync,
} = {}) {
  const profile = resolveReleaseProfile(profileId);
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
    profile.release.attestationEvidenceFileName,
    'release attestation evidence file name',
  );
  const evidencePath = path.join(
    normalizedReleaseAssetsDir,
    profile.release.attestationEvidenceFileName,
  );
  const manifest = readJsonFile(manifestPath, 'finalized release manifest');
  const artifacts = Array.isArray(manifest?.artifacts) ? manifest.artifacts : [];
  if (artifacts.length === 0) {
    throw new Error('Release manifest artifacts must not be empty.');
  }

  const normalizedRepository = String(repository ?? '').trim()
    || String(manifest?.repository ?? '').trim();
  if (!normalizedRepository) {
    throw new Error('repository is required to write release attestation evidence.');
  }

  const normalizedReleaseTag = String(releaseTag ?? '').trim()
    || String(manifest?.releaseTag ?? '').trim();
  if (!normalizedReleaseTag) {
    throw new Error('releaseTag is required to write release attestation evidence.');
  }

  const predicateType = String(profile.release.attestationPredicateType ?? '').trim();
  const signerWorkflow = String(profile.release.attestationSignerWorkflowPath ?? '').trim();
  const sourceRef = `refs/tags/${normalizedReleaseTag}`;
  const generatedAt = now();
  const evidenceArtifacts = [];

  for (const artifact of artifacts) {
    const relativePath = assertSafeReleaseRelativePath(
      artifact?.relativePath,
      'Finalized release manifest attestation artifact path',
    );
    const artifactPath = path.join(normalizedReleaseAssetsDir, relativePath);
    if (!existsSync(artifactPath)) {
      throw new Error(`Missing release artifact for attestation verification: ${relativePath}`);
    }
    if (!statSync(artifactPath).isFile()) {
      throw new Error(`Release artifact for attestation verification is not a file: ${relativePath}`);
    }

    const expectedSha256 = String(artifact?.sha256 ?? '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
      throw new Error(`Release manifest artifact is missing sha256 for attestation verification: ${relativePath}`);
    }

    const ghArgs = buildGhAttestationArgs({
      artifactPath,
      repository: normalizedRepository,
      sourceRef,
      predicateType,
    });
    const rawVerificationOutput = execFileSyncImpl('gh', ghArgs, {
      cwd: normalizedReleaseAssetsDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const verificationOutput = normalizeVerificationOutput(rawVerificationOutput, relativePath);
    if (!verificationOutputContainsDigest({
      verificationOutput,
      expectedSha256,
    })) {
      throw new Error(
        `Attestation verification did not bind expected digest for ${relativePath}: ${expectedSha256}.`,
      );
    }

    evidenceArtifacts.push({
      relativePath,
      sha256: expectedSha256,
      repository: normalizedRepository,
      releaseTag: normalizedReleaseTag,
      sourceRef,
      predicateType,
      signerWorkflow,
      verified: true,
      verifiedAt: generatedAt,
      verificationCommand: buildVerificationCommand(ghArgs),
    });
  }

  writeFileSync(
    evidencePath,
    `${JSON.stringify({
      schemaVersion: 1,
      repository: normalizedRepository,
      releaseTag: normalizedReleaseTag,
      sourceRef,
      generatedAt,
      predicateType,
      signerWorkflow,
      artifacts: evidenceArtifacts,
    }, null, 2)}\n`,
    'utf8',
  );

  return {
    evidencePath,
    artifactCount: evidenceArtifacts.length,
  };
}

function main() {
  const result = writeAttestationEvidence(parseArgs(process.argv.slice(2)));
  process.stdout.write(
    [
      'Release attestation evidence written.',
      `evidence=${result.evidencePath}`,
      `artifactCount=${result.artifactCount}`,
    ].join('\n'),
  );
  process.stdout.write('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
