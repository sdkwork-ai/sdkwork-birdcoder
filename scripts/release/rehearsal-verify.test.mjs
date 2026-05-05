import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  verifyReleaseRehearsalExecution,
} from './rehearsal-verify.mjs';
import {
  runReleaseCandidateDryRun,
} from './candidate-dry-run.mjs';

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-rehearsal-verify-'));

function writeFile(relativePath, content = `${relativePath}\n`) {
  const targetPath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
  return targetPath;
}

function createDryRunReport() {
  const dryRunAssetsDir = path.join(fixtureRoot, 'dry-run-assets');
  const dryRunReportPath = path.join(dryRunAssetsDir, 'release-candidate-dry-run-report.json');
  runReleaseCandidateDryRun({
    releaseAssetsDir: dryRunAssetsDir,
    reportPath: dryRunReportPath,
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
  return dryRunReportPath;
}

try {
  const dryRunReportPath = createDryRunReport();
  const releaseAssetsDir = path.join(fixtureRoot, 'real-release');
  const outputPath = path.join(fixtureRoot, 'reports', 'release-rehearsal-execution-report.json');

  for (const relativePath of [
    'release-manifest.json',
    'release-manifest.json.sha256.txt',
    'SHA256SUMS.txt',
    'release-attestations.json',
    'release-notes.md',
  ]) {
    writeFile(path.join('real-release', relativePath));
  }

  const passedReport = verifyReleaseRehearsalExecution({
    dryRunReportPath,
    releaseAssetsDir,
    outputPath,
    now: () => new Date('2026-04-12T02:03:04.000Z'),
  });

  assert.equal(passedReport.schemaVersion, 'birdcoder.releaseRehearsalExecution.v1');
  assert.equal(passedReport.status, 'passed');
  assert.equal(passedReport.generatedAt, '2026-04-12T02:03:04.000Z');
  assert.equal(passedReport.dryRunReportPath, dryRunReportPath);
  assert.equal(passedReport.releaseAssetsDir, releaseAssetsDir);
  assert.equal(passedReport.outputPath, outputPath);
  assert.deepEqual(passedReport.summary, {
    phaseCount: 8,
    commandCount: 19,
    externalGateCount: 3,
    evidencePathCount: 5,
    presentEvidenceCount: 5,
    missingEvidenceCount: 0,
    blockedPhaseIds: [],
    failedIntegrityCheckIds: [],
  });
  assert.deepEqual(
    passedReport.checks.map((check) => [check.id, check.status]),
    [
      ['dry-run-report-schema', 'passed'],
      ['rehearsal-plan-schema', 'passed'],
      ['rehearsal-command-consistency', 'passed'],
      ['rehearsal-evidence-paths', 'passed'],
    ],
  );
  assert.equal(fs.existsSync(outputPath), true);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(outputPath, 'utf8')).summary,
    passedReport.summary,
  );

  fs.rmSync(path.join(releaseAssetsDir, 'release-attestations.json'));
  const blockedReport = verifyReleaseRehearsalExecution({
    dryRunReportPath,
    releaseAssetsDir,
    outputPath: path.join(fixtureRoot, 'reports', 'release-rehearsal-execution-report.blocked.json'),
    now: () => new Date('2026-04-12T02:04:05.000Z'),
  });

  assert.equal(blockedReport.status, 'blocked');
  assert.deepEqual(blockedReport.summary.blockedPhaseIds, ['attestation', 'publish-readiness']);
  assert.deepEqual(
    blockedReport.missingEvidence.map((entry) => entry.logicalPath),
    ['artifacts/release/release-attestations.json'],
  );
  assert.equal(
    blockedReport.checks.find((check) => check.id === 'rehearsal-evidence-paths')?.status,
    'blocked',
  );

  const inconsistentReportPath = path.join(fixtureRoot, 'dry-run-assets', 'inconsistent-report.json');
  const inconsistentReport = JSON.parse(fs.readFileSync(dryRunReportPath, 'utf8'));
  inconsistentReport.recommendedNextCommands = inconsistentReport.recommendedNextCommands.slice(0, -1);
  fs.writeFileSync(inconsistentReportPath, `${JSON.stringify(inconsistentReport, null, 2)}\n`, 'utf8');
  const failedReport = verifyReleaseRehearsalExecution({
    dryRunReportPath: inconsistentReportPath,
    releaseAssetsDir,
    outputPath: path.join(fixtureRoot, 'reports', 'release-rehearsal-execution-report.failed.json'),
    now: () => new Date('2026-04-12T02:05:06.000Z'),
  });

  assert.equal(failedReport.status, 'failed');
  assert.deepEqual(failedReport.summary.failedIntegrityCheckIds, ['rehearsal-command-consistency']);
  assert.equal(
    failedReport.checks.find((check) => check.id === 'rehearsal-command-consistency')?.status,
    'failed',
  );
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('release rehearsal verification contract passed.');
