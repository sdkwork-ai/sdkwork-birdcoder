#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_RELEASE_TAG as DEFAULT_READINESS_FIXTURE_TAG,
  DEFAULT_REPOSITORY,
  writeReleaseReadinessFixture,
} from './write-readiness-fixture.mjs';
import {
  DEFAULT_RELEASE_PROFILE_ID,
  resolveReleaseProfile,
} from './release-profiles.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

export const DEFAULT_RELEASE_CANDIDATE_DRY_RUN_DIR = path.join(
  rootDir,
  'artifacts',
  'release-candidate-dry-run',
);
export const DEFAULT_RELEASE_CANDIDATE_DRY_RUN_REPORT_PATH = path.join(
  DEFAULT_RELEASE_CANDIDATE_DRY_RUN_DIR,
  'release-candidate-dry-run-report.json',
);
export const DEFAULT_RELEASE_CANDIDATE_DRY_RUN_TAG = 'release-candidate-dry-run';
const RELEASE_CANDIDATE_DRY_RUN_REPORT_FILE_NAME = 'release-candidate-dry-run-report.json';
export const RELEASE_CANDIDATE_DRY_RUN_REPORT_SCHEMA_VERSION = 'birdcoder.releaseCandidateDryRun.v2';
export const RELEASE_CANDIDATE_REHEARSAL_PLAN_SCHEMA_VERSION = 'birdcoder.releaseRehearsalPlan.v1';

export const RELEASE_CANDIDATE_DRY_RUN_RECOMMENDED_NEXT_COMMANDS = Object.freeze([
  'pnpm release:plan',
  'pnpm release:preflight:desktop-signing',
  'pnpm release:package:desktop',
  'pnpm release:package:server',
  'pnpm release:package:container',
  'pnpm release:package:kubernetes',
  'pnpm release:package:web',
  'pnpm release:verify-trust:desktop',
  'pnpm release:smoke:desktop',
  'pnpm release:smoke:desktop-packaged-launch',
  'pnpm release:smoke:server',
  'pnpm release:smoke:container',
  'pnpm release:smoke:kubernetes',
  'pnpm release:smoke:web',
  'pnpm release:finalize',
  'pnpm release:smoke:finalized',
  'node scripts/release/render-release-notes.mjs --release-tag <tag> --release-assets-dir artifacts/release --output artifacts/release/release-notes.md',
  'pnpm release:write-attestation-evidence -- --repository <owner/repo> --release-tag <tag>',
  'pnpm release:assert-ready',
]);

const REAL_RELEASE_ASSETS_DIR = 'artifacts/release';
const RELEASE_NOTES_FILE_NAME = 'release-notes.md';

function releaseEvidencePath(fileName) {
  return `${REAL_RELEASE_ASSETS_DIR}/${fileName}`;
}

export function buildReleaseCandidateRehearsalPlan({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  resolveReleaseProfileFn = resolveReleaseProfile,
} = {}) {
  const profile = resolveReleaseProfileFn(profileId);
  const evidencePaths = [
    releaseEvidencePath(profile.release.manifestFileName),
    releaseEvidencePath(profile.release.manifestChecksumFileName),
    releaseEvidencePath(profile.release.globalChecksumsFileName),
    releaseEvidencePath(profile.release.attestationEvidenceFileName),
    releaseEvidencePath(RELEASE_NOTES_FILE_NAME),
  ];
  const phases = [
    {
      id: 'plan',
      label: 'Resolve release plan',
      commands: ['pnpm release:plan'],
      evidencePaths: [],
      externalGate: false,
      requiredOperatorInputs: [],
      stopShipChecks: [
        'Release tag, release kind, rollout stage, monitoring window, and rollback metadata must be explicit before packaging.',
      ],
    },
    {
      id: 'environment-preflight',
      label: 'Preflight desktop signing environment',
      commands: ['pnpm release:preflight:desktop-signing'],
      evidencePaths: [],
      externalGate: true,
      requiredOperatorInputs: [
        'Windows Authenticode certificate and timestamp URL when building Windows installers',
        'macOS codesign identity and notarization credentials when building macOS installers',
        'Linux package metadata tools when building Linux native packages',
      ],
      stopShipChecks: [
        'Desktop packaging must not start when required signing tools, package metadata tools, or credential environment variables are missing for the requested target.',
      ],
    },
    {
      id: 'package',
      label: 'Package release families',
      commands: [
        'pnpm release:package:desktop',
        'pnpm release:package:server',
        'pnpm release:package:container',
        'pnpm release:package:kubernetes',
        'pnpm release:package:web',
      ],
      evidencePaths: [
        `${REAL_RELEASE_ASSETS_DIR}/desktop/**/release-asset-manifest.json`,
        `${REAL_RELEASE_ASSETS_DIR}/server/**/release-asset-manifest.json`,
        `${REAL_RELEASE_ASSETS_DIR}/container/**/release-asset-manifest.json`,
        `${REAL_RELEASE_ASSETS_DIR}/kubernetes/**/release-asset-manifest.json`,
        `${REAL_RELEASE_ASSETS_DIR}/web/release-asset-manifest.json`,
      ],
      externalGate: false,
      requiredOperatorInputs: [],
      stopShipChecks: [
        'Every family manifest must satisfy the active release profile target matrix before finalization.',
      ],
    },
    {
      id: 'trust',
      label: 'Verify desktop installer trust',
      commands: ['pnpm release:verify-trust:desktop'],
      evidencePaths: [
        `${REAL_RELEASE_ASSETS_DIR}/desktop/**/desktop-installer-trust-report.json`,
      ],
      externalGate: true,
      requiredOperatorInputs: [
        'Platform trust tooling for the packaged desktop installer target',
      ],
      stopShipChecks: [
        'Formal or general-availability releases require every desktop installer signatureEvidence status to be passed before smoke, finalization, or publication.',
      ],
    },
    {
      id: 'smoke',
      label: 'Smoke packaged artifacts',
      commands: [
        'pnpm release:smoke:desktop',
        'pnpm release:smoke:desktop-packaged-launch',
        'pnpm release:smoke:server',
        'pnpm release:smoke:container',
        'pnpm release:smoke:kubernetes',
        'pnpm release:smoke:web',
      ],
      evidencePaths: [
        `${REAL_RELEASE_ASSETS_DIR}/**/*smoke-report.json`,
      ],
      externalGate: false,
      requiredOperatorInputs: [],
      stopShipChecks: [
        'Every packaged artifact smoke report must be passed or an explicitly governed skip before finalization.',
      ],
    },
    {
      id: 'finalize',
      label: 'Finalize release metadata',
      commands: [
        'pnpm release:finalize',
        'pnpm release:smoke:finalized',
        'node scripts/release/render-release-notes.mjs --release-tag <tag> --release-assets-dir artifacts/release --output artifacts/release/release-notes.md',
      ],
      evidencePaths: evidencePaths.filter((entry) => entry !== releaseEvidencePath(profile.release.attestationEvidenceFileName)),
      externalGate: false,
      requiredOperatorInputs: [],
      stopShipChecks: [
        'Finalized manifest, manifest checksum sidecar, SHA256SUMS, release notes, quality evidence, and finalized smoke must remain internally consistent.',
      ],
    },
    {
      id: 'attestation',
      label: 'Write attestation evidence',
      commands: [
        'pnpm release:write-attestation-evidence -- --repository <owner/repo> --release-tag <tag>',
      ],
      evidencePaths: [
        releaseEvidencePath(profile.release.attestationEvidenceFileName),
      ],
      externalGate: true,
      requiredOperatorInputs: [
        'GitHub artifact attestation access',
        'Repository slug',
        'Final release tag',
      ],
      stopShipChecks: [
        'Every finalized artifact must have verified, digest-bound GitHub attestation evidence before readiness assertion.',
      ],
    },
    {
      id: 'publish-readiness',
      label: 'Assert publish readiness',
      commands: ['pnpm release:assert-ready'],
      evidencePaths,
      externalGate: false,
      requiredOperatorInputs: [],
      stopShipChecks: [
        'Readiness assertion must reject partial coverage, checksum drift, missing attestation evidence, and incomplete formal/GA desktop trust evidence.',
      ],
    },
  ];
  const planCommands = phases.flatMap((phase) => phase.commands);

  return {
    schemaVersion: RELEASE_CANDIDATE_REHEARSAL_PLAN_SCHEMA_VERSION,
    status: 'ready',
    releaseAssetsDir: REAL_RELEASE_ASSETS_DIR,
    commandCount: planCommands.length,
    externalGateCount: phases.filter((phase) => phase.externalGate === true).length,
    evidencePaths,
    phases,
    stopShipChecks: [
      'Abort when any command exits non-zero.',
      'Abort when desktop signing preflight, installer trust verification, smoke, finalization, attestation evidence, or readiness assertion reports a failed or blocked status.',
      'Abort when releaseCoverage is partial, allowPartialRelease is true, checksum evidence drifts, attestation evidence is missing, or formal/GA desktop installer trust evidence is not passed.',
    ],
  };
}

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function normalizePathOption(value) {
  return path.resolve(rootDir, value);
}

function writeJson(targetPath, value) {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`);
}

export function parseArgs(argv) {
  const options = {
    profileId: DEFAULT_RELEASE_PROFILE_ID,
    releaseTag: DEFAULT_RELEASE_CANDIDATE_DRY_RUN_TAG,
    repository: DEFAULT_REPOSITORY,
    releaseAssetsDir: DEFAULT_RELEASE_CANDIDATE_DRY_RUN_DIR,
    reportPath: null,
    clean: true,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--profile') {
      options.profileId = readOptionValue(argv, index, '--profile');
      index += 1;
      continue;
    }
    if (token === '--release-tag') {
      options.releaseTag = readOptionValue(argv, index, '--release-tag');
      index += 1;
      continue;
    }
    if (token === '--repository') {
      options.repository = readOptionValue(argv, index, '--repository');
      index += 1;
      continue;
    }
    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = normalizePathOption(readOptionValue(argv, index, '--release-assets-dir'));
      index += 1;
      continue;
    }
    if (token === '--report-path') {
      options.reportPath = normalizePathOption(readOptionValue(argv, index, '--report-path'));
      index += 1;
      continue;
    }
    if (token === '--no-clean') {
      options.clean = false;
      continue;
    }
    if (token === '--help') {
      options.help = true;
      continue;
    }

    throw new Error(`Unsupported release candidate dry-run option: ${token}`);
  }

  return {
    ...options,
    reportPath: options.reportPath ?? path.join(options.releaseAssetsDir, RELEASE_CANDIDATE_DRY_RUN_REPORT_FILE_NAME),
  };
}

export function buildReleaseCandidateDryRunReport({
  generatedAt,
  profileId,
  releaseTag,
  repository,
  releaseAssetsDir,
  reportPath,
  fixtureResult,
}) {
  return {
    schemaVersion: RELEASE_CANDIDATE_DRY_RUN_REPORT_SCHEMA_VERSION,
    status: 'passed',
    generatedAt,
    profileId,
    releaseTag,
    repository,
    releaseAssetsDir,
    reportPath,
    manifestPath: fixtureResult.manifestPath,
    checksumsPath: fixtureResult.checksumsPath,
    attestationEvidencePath: fixtureResult.attestationEvidencePath,
    artifactCount: fixtureResult.artifactCount,
    requiredTargetCount: fixtureResult.requiredTargetCount,
    releasePlanTargetCount: fixtureResult.releasePlanTargetCount,
    readiness: fixtureResult.readiness,
    stopShipSignals: [],
    recommendedNextCommands: [...RELEASE_CANDIDATE_DRY_RUN_RECOMMENDED_NEXT_COMMANDS],
    rehearsalPlan: buildReleaseCandidateRehearsalPlan({
      profileId,
    }),
  };
}

export function runReleaseCandidateDryRun({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  releaseTag = DEFAULT_RELEASE_CANDIDATE_DRY_RUN_TAG,
  repository = DEFAULT_REPOSITORY,
  releaseAssetsDir = DEFAULT_RELEASE_CANDIDATE_DRY_RUN_DIR,
  reportPath = null,
  clean = true,
  now = () => new Date(),
  writeReleaseReadinessFixtureFn = writeReleaseReadinessFixture,
} = {}) {
  const normalizedProfileId = String(profileId ?? '').trim() || DEFAULT_RELEASE_PROFILE_ID;
  const normalizedReleaseTag = String(releaseTag ?? '').trim()
    || DEFAULT_RELEASE_CANDIDATE_DRY_RUN_TAG
    || DEFAULT_READINESS_FIXTURE_TAG;
  const normalizedRepository = String(repository ?? '').trim() || DEFAULT_REPOSITORY;
  const normalizedReleaseAssetsDir = path.resolve(releaseAssetsDir);
  const normalizedReportPath = path.resolve(
    reportPath ?? path.join(normalizedReleaseAssetsDir, RELEASE_CANDIDATE_DRY_RUN_REPORT_FILE_NAME),
  );

  const fixtureResult = writeReleaseReadinessFixtureFn({
    profileId: normalizedProfileId,
    releaseTag: normalizedReleaseTag,
    repository: normalizedRepository,
    releaseAssetsDir: normalizedReleaseAssetsDir,
    clean,
    assertReady: true,
  });

  const report = buildReleaseCandidateDryRunReport({
    generatedAt: now().toISOString(),
    profileId: normalizedProfileId,
    releaseTag: normalizedReleaseTag,
    repository: normalizedRepository,
    releaseAssetsDir: normalizedReleaseAssetsDir,
    reportPath: normalizedReportPath,
    fixtureResult,
  });

  writeJson(normalizedReportPath, report);

  return report;
}

function printHelp() {
  process.stdout.write([
    'Usage: node scripts/release/candidate-dry-run.mjs [options]',
    '',
    'Generate a complete synthetic BirdCoder release candidate, assert release readiness, and write a machine-readable dry-run report.',
    '',
    'Options:',
    '  --profile <id>              Release profile id (default: sdkwork-birdcoder)',
    '  --release-tag <tag>         Synthetic release tag (default: release-candidate-dry-run)',
    '  --repository <owner/repo>   Repository slug for attestation evidence',
    '  --release-assets-dir <dir>  Output directory (default: artifacts/release-candidate-dry-run)',
    '  --report-path <file>        Report file path (default: artifacts/release-candidate-dry-run/release-candidate-dry-run-report.json)',
    '  --no-clean                  Do not remove the output directory before writing',
    '  --help                      Show this help message',
    '',
  ].join('\n'));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const result = runReleaseCandidateDryRun(options);
  process.stdout.write([
    'Release candidate dry-run passed.',
    `report=${result.reportPath}`,
    `releaseAssetsDir=${result.releaseAssetsDir}`,
    `manifest=${result.manifestPath}`,
    `artifactCount=${result.artifactCount}`,
    `requiredTargetCount=${result.requiredTargetCount}`,
    `releasePlanTargetCount=${result.releasePlanTargetCount}`,
    '',
  ].join('\n'));
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
