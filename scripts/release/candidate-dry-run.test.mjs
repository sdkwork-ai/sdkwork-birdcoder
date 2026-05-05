import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_RELEASE_CANDIDATE_DRY_RUN_DIR,
  DEFAULT_RELEASE_CANDIDATE_DRY_RUN_REPORT_PATH,
  DEFAULT_RELEASE_CANDIDATE_DRY_RUN_TAG,
  RELEASE_CANDIDATE_DRY_RUN_REPORT_SCHEMA_VERSION,
  RELEASE_CANDIDATE_REHEARSAL_PLAN_SCHEMA_VERSION,
  parseArgs,
  runReleaseCandidateDryRun,
} from './candidate-dry-run.mjs';
import {
  assertSafeReleaseReadinessFixtureDir,
} from './write-readiness-fixture.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-candidate-dry-run-'));

try {
  assert.equal(
    DEFAULT_RELEASE_CANDIDATE_DRY_RUN_DIR,
    path.join(repoRoot, 'artifacts', 'release-candidate-dry-run'),
  );
  assert.equal(
    DEFAULT_RELEASE_CANDIDATE_DRY_RUN_REPORT_PATH,
    path.join(repoRoot, 'artifacts', 'release-candidate-dry-run', 'release-candidate-dry-run-report.json'),
  );
  assert.equal(DEFAULT_RELEASE_CANDIDATE_DRY_RUN_TAG, 'release-candidate-dry-run');
  assert.doesNotThrow(
    () => assertSafeReleaseReadinessFixtureDir(DEFAULT_RELEASE_CANDIDATE_DRY_RUN_DIR),
  );

  assert.throws(
    () => parseArgs(['--release-assets-dir']),
    /Missing value for --release-assets-dir/,
  );
  assert.throws(
    () => parseArgs(['--report-path']),
    /Missing value for --report-path/,
  );
  assert.throws(
    () => parseArgs(['--unknown']),
    /Unsupported release candidate dry-run option: --unknown/,
  );
  assert.deepEqual(
    parseArgs([
      '--release-assets-dir',
      path.join(fixtureRoot, 'custom-release-candidate-assets'),
    ]),
    {
      profileId: 'sdkwork-birdcoder',
      releaseTag: 'release-candidate-dry-run',
      repository: 'Sdkwork-Cloud/sdkwork-birdcoder',
      releaseAssetsDir: path.join(fixtureRoot, 'custom-release-candidate-assets'),
      reportPath: path.join(fixtureRoot, 'custom-release-candidate-assets', 'release-candidate-dry-run-report.json'),
      clean: true,
      help: false,
    },
  );
  assert.deepEqual(
    parseArgs([
      '--profile',
      'sdkwork-birdcoder',
      '--release-tag',
      'release-candidate-2026.04.12',
      '--repository',
      'Sdkwork-Cloud/sdkwork-birdcoder',
      '--release-assets-dir',
      path.join(fixtureRoot, 'release-candidate-dry-run'),
      '--report-path',
      path.join(fixtureRoot, 'candidate-report.json'),
      '--no-clean',
    ]),
    {
      profileId: 'sdkwork-birdcoder',
      releaseTag: 'release-candidate-2026.04.12',
      repository: 'Sdkwork-Cloud/sdkwork-birdcoder',
      releaseAssetsDir: path.join(fixtureRoot, 'release-candidate-dry-run'),
      reportPath: path.join(fixtureRoot, 'candidate-report.json'),
      clean: false,
      help: false,
    },
  );

  const customAssetsOnlyDir = path.join(fixtureRoot, 'assets-only-release-candidate');
  const customAssetsOnlyResult = runReleaseCandidateDryRun({
    releaseAssetsDir: customAssetsOnlyDir,
    now: () => new Date('2026-04-12T01:02:03.000Z'),
    writeReleaseReadinessFixtureFn: (options) => ({
      releaseAssetsDir: options.releaseAssetsDir,
      manifestPath: path.join(options.releaseAssetsDir, 'release-manifest.json'),
      checksumsPath: path.join(options.releaseAssetsDir, 'SHA256SUMS.txt'),
      attestationEvidencePath: path.join(options.releaseAssetsDir, 'release-attestations.json'),
      artifactCount: 33,
      requiredTargetCount: 27,
      releasePlanTargetCount: 27,
      readiness: {
        artifactCount: 33,
        requiredTargetCount: 27,
      },
    }),
  });
  assert.equal(
    customAssetsOnlyResult.reportPath,
    path.join(customAssetsOnlyDir, 'release-candidate-dry-run-report.json'),
  );

  const releaseAssetsDir = path.join(fixtureRoot, 'release-candidate-dry-run');
  const reportPath = path.join(fixtureRoot, 'candidate-report.json');
  const result = runReleaseCandidateDryRun({
    profileId: 'sdkwork-birdcoder',
    releaseTag: 'release-candidate-test',
    repository: 'Sdkwork-Cloud/sdkwork-birdcoder',
    releaseAssetsDir,
    reportPath,
    now: () => new Date('2026-04-12T01:02:03.000Z'),
  });

  assert.equal(result.status, 'passed');
  assert.equal(result.profileId, 'sdkwork-birdcoder');
  assert.equal(result.releaseTag, 'release-candidate-test');
  assert.equal(result.repository, 'Sdkwork-Cloud/sdkwork-birdcoder');
  assert.equal(result.releaseAssetsDir, releaseAssetsDir);
  assert.equal(result.reportPath, reportPath);
  assert.equal(result.artifactCount, 33);
  assert.equal(result.requiredTargetCount, 27);
  assert.equal(result.releasePlanTargetCount, 27);
  assert.equal(result.readiness?.artifactCount, 33);
  assert.equal(result.readiness?.requiredTargetCount, 27);
  assert.equal(fs.existsSync(result.manifestPath), true);
  assert.equal(fs.existsSync(result.checksumsPath), true);
  assert.equal(fs.existsSync(result.attestationEvidencePath), true);
  assert.equal(fs.existsSync(reportPath), true);

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(RELEASE_CANDIDATE_DRY_RUN_REPORT_SCHEMA_VERSION, 'birdcoder.releaseCandidateDryRun.v2');
  assert.equal(RELEASE_CANDIDATE_REHEARSAL_PLAN_SCHEMA_VERSION, 'birdcoder.releaseRehearsalPlan.v1');
  assert.equal(report.schemaVersion, RELEASE_CANDIDATE_DRY_RUN_REPORT_SCHEMA_VERSION);
  assert.equal(report.status, 'passed');
  assert.equal(report.generatedAt, '2026-04-12T01:02:03.000Z');
  assert.equal(report.profileId, result.profileId);
  assert.equal(report.releaseTag, result.releaseTag);
  assert.equal(report.repository, result.repository);
  assert.equal(report.releaseAssetsDir, result.releaseAssetsDir);
  assert.equal(report.manifestPath, result.manifestPath);
  assert.equal(report.checksumsPath, result.checksumsPath);
  assert.equal(report.attestationEvidencePath, result.attestationEvidencePath);
  assert.equal(report.artifactCount, 33);
  assert.equal(report.requiredTargetCount, 27);
  assert.equal(report.releasePlanTargetCount, 27);
  assert.equal(report.readiness.artifactCount, 33);
  assert.equal(report.readiness.requiredTargetCount, 27);
  assert.deepEqual(report.stopShipSignals, []);
  assert.deepEqual(report.recommendedNextCommands, [
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
  assert.equal(report.rehearsalPlan.schemaVersion, RELEASE_CANDIDATE_REHEARSAL_PLAN_SCHEMA_VERSION);
  assert.equal(report.rehearsalPlan.status, 'ready');
  assert.equal(report.rehearsalPlan.commandCount, report.recommendedNextCommands.length);
  assert.equal(report.rehearsalPlan.externalGateCount, 3);
  assert.deepEqual(
    report.rehearsalPlan.evidencePaths,
    [
      'artifacts/release/release-manifest.json',
      'artifacts/release/release-manifest.json.sha256.txt',
      'artifacts/release/SHA256SUMS.txt',
      'artifacts/release/release-attestations.json',
      'artifacts/release/release-notes.md',
    ],
  );
  assert.deepEqual(
    report.rehearsalPlan.phases.map((phase) => phase.id),
    [
      'plan',
      'environment-preflight',
      'package',
      'trust',
      'smoke',
      'finalize',
      'attestation',
      'publish-readiness',
    ],
  );
  assert.deepEqual(
    report.rehearsalPlan.phases.flatMap((phase) => phase.commands),
    report.recommendedNextCommands,
  );
  assert.deepEqual(
    report.rehearsalPlan.phases.find((phase) => phase.id === 'finalize').commands,
    [
      'pnpm release:finalize',
      'pnpm release:smoke:finalized',
      'node scripts/release/render-release-notes.mjs --release-tag <tag> --release-assets-dir artifacts/release --output artifacts/release/release-notes.md',
    ],
  );
  assert.deepEqual(
    report.rehearsalPlan.phases
      .filter((phase) => phase.externalGate === true)
      .map((phase) => phase.id),
    ['environment-preflight', 'trust', 'attestation'],
  );
  assert.deepEqual(
    report.rehearsalPlan.phases.find((phase) => phase.id === 'environment-preflight').requiredOperatorInputs,
    [
      'Windows Authenticode certificate and timestamp URL when building Windows installers',
      'macOS codesign identity and notarization credentials when building macOS installers',
      'Linux package metadata tools when building Linux native packages',
    ],
  );
  assert.deepEqual(
    report.rehearsalPlan.phases.find((phase) => phase.id === 'attestation').requiredOperatorInputs,
    [
      'GitHub artifact attestation access',
      'Repository slug',
      'Final release tag',
    ],
  );
  assert.deepEqual(
    report.rehearsalPlan.stopShipChecks,
    [
      'Abort when any command exits non-zero.',
      'Abort when desktop signing preflight, installer trust verification, smoke, finalization, attestation evidence, or readiness assertion reports a failed or blocked status.',
      'Abort when releaseCoverage is partial, allowPartialRelease is true, checksum evidence drifts, attestation evidence is missing, or formal/GA desktop installer trust evidence is not passed.',
    ],
  );
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('release candidate dry-run contract passed.');
