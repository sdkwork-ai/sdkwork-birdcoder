import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { smokeDesktopStartupEvidence } from './smoke-desktop-startup-evidence.mjs';

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-desktop-startup-smoke-'));
const familyDir = path.join(releaseAssetsDir, 'desktop', 'windows', 'x64');
fs.mkdirSync(familyDir, { recursive: true });
fs.writeFileSync(path.join(familyDir, 'sdkwork-birdcoder-desktop-release-local-windows-x64.tar.gz'), 'tar');
fs.writeFileSync(
  path.join(familyDir, 'release-asset-manifest.json'),
  JSON.stringify({
    family: 'desktop',
    platform: 'windows',
    arch: 'x64',
    archiveRelativePath: 'desktop/windows/x64/sdkwork-birdcoder-desktop-release-local-windows-x64.tar.gz',
    artifacts: [
      {
        relativePath: 'desktop/windows/x64/sdkwork-birdcoder-desktop-release-local-windows-x64.tar.gz',
        size: 3,
      },
    ],
  }, null, 2),
);

const result = smokeDesktopStartupEvidence({
  releaseAssetsDir,
  platform: 'windows',
  arch: 'x64',
  target: 'x86_64-pc-windows-msvc',
});

assert.equal(result.smokeKind, 'startup-evidence-contract');
assert.ok(fs.existsSync(result.capturedEvidencePath));
assert.ok(fs.existsSync(result.smokeReportPath));

const capturedEvidence = JSON.parse(fs.readFileSync(result.capturedEvidencePath, 'utf8'));
assert.equal(capturedEvidence.status, 'passed');
assert.equal(capturedEvidence.readinessEvidence.ready, true);
assert.equal(capturedEvidence.readinessEvidence.shellMounted, true);
assert.deepEqual(capturedEvidence.readinessEvidence.workspaceBootstrap, {
  defaultWorkspaceReady: true,
  defaultProjectReady: true,
  recoverySnapshotReady: true,
});
assert.deepEqual(capturedEvidence.readinessEvidence.localProjectRecovery, {
  autoRemountSupported: true,
  recoveringStateVisible: true,
  failedStateVisible: true,
  retrySupported: true,
  reimportSupported: true,
});

const smokeReport = JSON.parse(fs.readFileSync(result.smokeReportPath, 'utf8'));
assert.equal(smokeReport.status, 'passed');
assert.equal(smokeReport.capturedEvidenceRelativePath, 'desktop/windows/x64/desktop-startup-evidence.json');
assert.ok(
  smokeReport.checks.some(
    (entry) =>
      entry.id === 'workspace-bootstrap-ready'
      && entry.status === 'passed',
  ),
  'desktop startup smoke must record seeded workspace/project readiness in the report checks.',
);
assert.ok(
  smokeReport.checks.some(
    (entry) =>
      entry.id === 'local-project-recovery-ready'
      && entry.status === 'passed',
  ),
  'desktop startup smoke must record local project recovery readiness in the report checks.',
);

fs.rmSync(releaseAssetsDir, { recursive: true, force: true });
console.log('desktop startup smoke contract passed.');
