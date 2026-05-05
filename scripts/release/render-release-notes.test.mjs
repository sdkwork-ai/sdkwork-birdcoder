import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS } from '../governance-regression-report.mjs';
import {
  buildReleaseNotesMarkdown,
  parseArgs,
  renderReleaseNotes,
} from './render-release-notes.mjs';

function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const expectedReleaseGovernanceLine = `Release governance checks: ${ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS.map((entry) => `\`${entry}\``).join(', ')}`;

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-notes-'));
const releaseAssetsDir = path.join(fixtureRoot, 'assets');
fs.mkdirSync(releaseAssetsDir, { recursive: true });
fs.mkdirSync(path.join(releaseAssetsDir, 'server', 'windows', 'x64'), { recursive: true });
const publishArtifactRelativePath = 'server/windows/x64/server.tar.gz';
const publishArtifactContent = Buffer.from('publishable server release archive\n', 'utf8');
fs.writeFileSync(path.join(releaseAssetsDir, publishArtifactRelativePath), publishArtifactContent);
const publishArtifactSha256 = crypto
  .createHash('sha256')
  .update(publishArtifactContent)
  .digest('hex');
fs.writeFileSync(
  path.join(releaseAssetsDir, 'release-manifest.json'),
  JSON.stringify({
    generatedAt: '2026-04-08T00:00:00.000Z',
    checksumFileName: 'SHA256SUMS.txt',
    releaseControl: {
      releaseKind: 'canary',
      rolloutStage: 'ring-1',
      monitoringWindowMinutes: 45,
      rollbackRunbookRef: 'docs/step/13-发布就绪-github-flow-灰度回滚闭环.md',
      rollbackCommand: 'gh workflow run rollback.yml --ref main',
    },
    assets: [
      {
        family: 'desktop',
        file: 'desktop/windows/x64/desktop.tar.gz',
        platform: 'windows',
        arch: 'x64',
        desktopStartupSmoke: { status: 'passed' },
        desktopStartupReadinessSummary: {
          ready: true,
          shellMounted: true,
          workspaceBootstrapReady: true,
          localProjectRecoveryReady: true,
          workspaceBootstrapChecks: [
            'defaultWorkspaceReady',
            'defaultProjectReady',
            'recoverySnapshotReady',
          ],
          localProjectRecoveryChecks: [
            'autoRemountSupported',
            'recoveringStateVisible',
            'failedStateVisible',
            'retrySupported',
            'reimportSupported',
          ],
        },
      },
      {
        family: 'server',
        file: 'server/release-manifest.json',
        platform: 'linux',
        arch: 'x64',
        artifacts: [
          {
            relativePath: publishArtifactRelativePath,
          },
        ],
        releaseSmoke: { status: 'passed' },
      },
      {
        family: 'web',
        file: 'web/release-manifest.json',
      },
    ],
    codingServerOpenApiEvidence: {
      canonicalRelativePath: 'server/windows/x64/openapi/coding-server-v1.json',
      mirroredRelativePaths: ['server/windows/x64/openapi/coding-server-v1.json'],
      targetCount: 1,
      targets: ['windows/x64'],
      sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      openapi: '3.1.0',
      version: 'v1',
      title: 'SDKWork BirdCoder Coding Server API',
    },
    artifacts: [
      {
        family: 'server',
        platform: 'windows',
        arch: 'x64',
        target: '',
        accelerator: '',
        kind: 'archive',
        relativePath: publishArtifactRelativePath,
        sha256: publishArtifactSha256,
        size: publishArtifactContent.length,
      },
    ],
    qualityEvidence: {
      archiveRelativePath: 'quality/quality-gate-matrix-report.json',
      totalTiers: 3,
      workflowBoundTiers: 2,
      missingWorkflowBindings: ['release'],
      manifestBoundTiers: 2,
      missingManifestBindings: ['release'],
      tierIds: ['fast', 'standard', 'release'],
      failureClassificationIds: ['contract-drift', 'toolchain-platform', 'artifact-integrity', 'evidence-gap'],
      environmentDiagnostics: 1,
      blockingDiagnosticIds: ['vite-host-build-preflight'],
      releaseGovernanceCheckIds: ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS,
      blockingDiagnostics: [
        {
          id: 'vite-host-build-preflight',
          label: 'Vite host build preflight',
          classification: 'toolchain-platform',
          appliesTo: ['standard', 'release'],
          summary: 'Windows host cannot spawn cmd.exe or esbuild.exe (spawn EPERM).',
          requiredCapabilities: ['cmd.exe shell execution', 'esbuild.exe process launch'],
          rerunCommands: ['pnpm check:quality:standard', 'pnpm check:quality:release'],
        },
      ],
      executionArchiveRelativePath: 'quality/quality-gate-execution-report.json',
      executionStatus: 'blocked',
      lastExecutedTierId: 'standard',
      executionBlockingTierIds: ['standard'],
      executionFailedTierIds: [],
      executionSkippedTierIds: ['release'],
      executionBlockingDiagnosticIds: ['vite-host-build-preflight'],
      loopScoreboard: {
        architecture_alignment: 67,
        implementation_completeness: 100,
        test_closure: 70,
        commercial_readiness: 60,
        lowest_score_item: 'commercial_readiness',
        next_focus: 'Clear blocking diagnostics (`vite-host-build-preflight`) and rerun quality gates.',
      },
    },
  }, null, 2),
);

const markdown = buildReleaseNotesMarkdown({
  profileId: 'sdkwork-birdcoder',
  releaseTag: 'release-local',
  releaseAssetsDir,
});

assert.match(markdown, /SDKWork BirdCoder release-local/);
assert.match(markdown, /server/);
assert.match(markdown, /web/);
assert.match(markdown, /desktop/);
assert.match(markdown, /Finalized at: 2026-04-08T00:00:00.000Z/);
assert.match(markdown, /Finalized release readiness: `blocked`/);
assert.match(
  markdown,
  /Finalized readiness signals: workflow topology drift `2\/3` missing `release`; manifest topology drift `2\/3` missing `release`; quality blockers `vite-host-build-preflight`; runtime blocked tiers `standard`; runtime blockers `vite-host-build-preflight`/,
);
assert.match(markdown, /Release kind: `canary`/);
assert.match(markdown, /Rollout stage: `ring-1`/);
assert.match(markdown, /Monitoring window: `45` minutes/);
assert.match(markdown, /Rollback runbook: `docs\/step\/13-发布就绪-github-flow-灰度回滚闭环\.md`/);
assert.match(markdown, /Rollback command: `gh workflow run rollback\.yml --ref main`/);
assert.match(markdown, /smoke: `passed`/);
assert.match(markdown, /startup readiness: `ready`/);
assert.match(markdown, /workspace bootstrap: `defaultProjectReady`, `defaultWorkspaceReady`, `recoverySnapshotReady`/);
assert.match(markdown, /local project recovery: `autoRemountSupported`, `failedStateVisible`, `recoveringStateVisible`, `reimportSupported`, `retrySupported`/);
assert.match(markdown, /## Coding-server OpenAPI evidence/);
assert.match(markdown, /Canonical snapshot: `server\/windows\/x64\/openapi\/coding-server-v1\.json`/);
assert.match(markdown, /Targets: `windows\/x64`/);
assert.match(markdown, /OpenAPI version: `3\.1\.0`/);
assert.match(markdown, /API version: `v1`/);
assert.match(markdown, /## Quality evidence/);
assert.match(markdown, /quality\/quality-gate-matrix-report\.json/);
assert.match(markdown, /Quality tiers: `fast`, `standard`, `release`/);
assert.match(markdown, /Workflow-bound tiers: `2\/3`/);
assert.match(markdown, /Missing workflow bindings: `release`/);
assert.match(markdown, /Manifest-bound tiers: `2\/3`/);
assert.match(markdown, /Missing manifest bindings: `release`/);
assert.match(markdown, /Blocking diagnostics: `vite-host-build-preflight`/);
assert.match(markdown, new RegExp(escapeRegExp(expectedReleaseGovernanceLine)));
assert.match(markdown, /toolchain-platform/);
assert.match(markdown, /spawn EPERM/);
assert.match(markdown, /Required host capabilities for `vite-host-build-preflight`: `cmd\.exe shell execution`, `esbuild\.exe process launch`/);
assert.match(markdown, /Rerun sequence for `vite-host-build-preflight`: `pnpm check:quality:standard` -> `pnpm check:quality:release`/);
assert.match(markdown, /Runtime execution report: `quality\/quality-gate-execution-report\.json`/);
assert.match(markdown, /Runtime gate status: `blocked`/);
assert.match(markdown, /Last executed tier: `standard`/);
assert.match(markdown, /Blocked tiers: `standard`/);
assert.match(markdown, /Skipped tiers: `release`/);
assert.match(markdown, /Runtime blocking diagnostics: `vite-host-build-preflight`/);
assert.match(markdown, /Loop scoreboard: `architecture_alignment=67`, `implementation_completeness=100`, `test_closure=70`, `commercial_readiness=60`/);
assert.match(markdown, /Lowest score item: `commercial_readiness`/);
assert.match(markdown, /Next focus: Clear blocking diagnostics \(`vite-host-build-preflight`\) and rerun quality gates\./);
assert.match(markdown, /## Post-release operations/);
assert.match(markdown, /Observation window: `45` minutes on `ring-1`/);
assert.match(markdown, /Stop-ship signals: workflow topology drift `2\/3` missing `release`; manifest topology drift `2\/3` missing `release`; quality blockers `vite-host-build-preflight`; runtime blocked tiers `standard`; runtime blockers `vite-host-build-preflight`/);
assert.match(markdown, /Rollback entry: `gh workflow run rollback\.yml --ref main`/);
assert.match(markdown, /Re-issue path: `pnpm release:plan` -> affected `release:package:\*` \/ `release:smoke:\*` -> `pnpm release:finalize`/);
assert.match(markdown, /Writeback targets: `docs\/release\/releases\.json`/);

const releaseReadinessAssetsDir = path.join(fixtureRoot, 'assets-release-readiness');
fs.mkdirSync(releaseReadinessAssetsDir, { recursive: true });
fs.writeFileSync(
  path.join(releaseReadinessAssetsDir, 'release-manifest.json'),
  JSON.stringify({
    generatedAt: '2026-04-08T00:00:00.000Z',
    assets: [],
    qualityEvidence: {
      archiveRelativePath: 'quality/quality-gate-matrix-report.json',
      totalTiers: 3,
      workflowBoundTiers: 3,
      missingWorkflowBindings: [],
      manifestBoundTiers: 3,
      missingManifestBindings: [],
      tierIds: ['fast', 'standard', 'release'],
      failureClassificationIds: ['contract-drift'],
      environmentDiagnostics: 0,
      blockingDiagnosticIds: [],
      releaseGovernanceCheckIds: ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS,
      executionStatus: 'passed',
      executionBlockingTierIds: [],
      executionFailedTierIds: [],
      executionSkippedTierIds: [],
      releaseReadinessSignals: ['desktop local project recovery `windows/x64` is `not-ready`'],
    },
  }, null, 2),
);

const releaseReadinessMarkdown = buildReleaseNotesMarkdown({
  profileId: 'sdkwork-birdcoder',
  releaseTag: 'release-local',
  releaseAssetsDir: releaseReadinessAssetsDir,
});

assert.match(
  releaseReadinessMarkdown,
  /Finalized release readiness: `blocked`/,
);
assert.match(
  releaseReadinessMarkdown,
  /Release readiness signals: desktop local project recovery `windows\/x64` is `not-ready`/,
);
assert.match(
  releaseReadinessMarkdown,
  /Finalized readiness signals: desktop local project recovery `windows\/x64` is `not-ready`/,
);
assert.match(
  releaseReadinessMarkdown,
  /Next focus: Clear release-readiness blockers \(desktop local project recovery `windows\/x64` is `not-ready`\) and rerun finalize smoke\./,
);

const parsed = parseArgs([
  '--release-tag', 'release-local',
  '--release-assets-dir', releaseAssetsDir,
  '--profile', 'sdkwork-birdcoder',
  '--output', 'release-notes.md',
]);
assert.equal(parsed.releaseTag, 'release-local');
assert.equal(parsed.profileId, 'sdkwork-birdcoder');
assert.equal(parsed.releaseAssetsDir, path.resolve(process.cwd(), releaseAssetsDir));
assert.equal(parsed.output, path.resolve(process.cwd(), 'release-notes.md'));
assert.throws(() => parseArgs(['--unknown']), /Unknown argument/);

const outputPath = path.join(fixtureRoot, 'release-notes.md');
renderReleaseNotes({
  profile: 'sdkwork-birdcoder',
  'release-tag': 'release-local',
  'release-assets-dir': releaseAssetsDir,
  output: outputPath,
});
assert.ok(fs.existsSync(outputPath));

const releaseAssetsOutputPath = path.join(releaseAssetsDir, 'release-notes.md');
const checksumsPath = path.join(releaseAssetsDir, 'SHA256SUMS.txt');
fs.writeFileSync(checksumsPath, 'stale-checksum  release-notes.md\n', 'utf8');
renderReleaseNotes({
  profile: 'sdkwork-birdcoder',
  'release-tag': 'release-local',
  'release-assets-dir': releaseAssetsDir,
  output: releaseAssetsOutputPath,
});
assert.equal(
  fs.readFileSync(checksumsPath, 'utf8'),
  `${publishArtifactSha256}  ${publishArtifactRelativePath}\n`,
  'rendering notes into a finalized release directory must preserve the manifest artifacts checksum view',
);

const missingQualityReleaseAssetsDir = path.join(fixtureRoot, 'assets-missing-quality');
fs.mkdirSync(missingQualityReleaseAssetsDir, { recursive: true });
fs.writeFileSync(
  path.join(missingQualityReleaseAssetsDir, 'release-manifest.json'),
  JSON.stringify({
    generatedAt: '2026-04-08T00:00:00.000Z',
    assets: [],
  }, null, 2),
);
assert.throws(
  () => buildReleaseNotesMarkdown({
    profileId: 'sdkwork-birdcoder',
    releaseTag: 'release-local',
    releaseAssetsDir: missingQualityReleaseAssetsDir,
  }),
  /Missing finalized manifest qualityEvidence summary/,
);

console.log('render release notes contract passed.');
