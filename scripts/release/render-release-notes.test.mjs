import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildReleaseNotesMarkdown,
  parseArgs,
  renderReleaseNotes,
} from './render-release-notes.mjs';

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-notes-'));
const releaseAssetsDir = path.join(fixtureRoot, 'assets');
fs.mkdirSync(releaseAssetsDir, { recursive: true });
fs.writeFileSync(
  path.join(releaseAssetsDir, 'release-manifest.json'),
  JSON.stringify({
    generatedAt: '2026-04-08T00:00:00.000Z',
    releaseControl: {
      releaseKind: 'canary',
      rolloutStage: 'ring-1',
      monitoringWindowMinutes: 45,
      rollbackRunbookRef: 'docs/step/13-发布就绪-github-flow-灰度回滚闭环.md',
      rollbackCommand: 'gh workflow run rollback.yml --ref main',
    },
    assets: [
      {
        family: 'server',
        file: 'server/release-manifest.json',
        platform: 'linux',
        arch: 'x64',
        releaseSmoke: { status: 'passed' },
      },
      {
        family: 'web',
        file: 'web/release-manifest.json',
      },
    ],
    governanceEvidence: {
      archiveRelativePath: 'terminal/governance/terminal-governance-diagnostics.json',
      entryCount: 1,
      blockedRecords: 1,
      riskLevels: ['P3'],
      approvalPolicies: ['Restricted'],
      latestRecordedAt: 1712577840000,
    },
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
    qualityEvidence: {
      archiveRelativePath: 'quality/quality-gate-matrix-report.json',
      totalTiers: 3,
      workflowBoundTiers: 3,
      tierIds: ['fast', 'standard', 'release'],
      failureClassificationIds: ['contract-drift', 'toolchain-platform', 'artifact-integrity', 'evidence-gap'],
      environmentDiagnostics: 1,
      blockingDiagnosticIds: ['vite-host-build-preflight'],
      releaseGovernanceCheckIds: ['engine-runtime-adapter', 'engine-conformance', 'tool-protocol', 'engine-resume-recovery'],
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
        architecture_alignment: 100,
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
assert.match(markdown, /Finalized at: 2026-04-08T00:00:00.000Z/);
assert.match(markdown, /Release kind: `canary`/);
assert.match(markdown, /Rollout stage: `ring-1`/);
assert.match(markdown, /Monitoring window: `45` minutes/);
assert.match(markdown, /Rollback runbook: `docs\/step\/13-发布就绪-github-flow-灰度回滚闭环\.md`/);
assert.match(markdown, /Rollback command: `gh workflow run rollback\.yml --ref main`/);
assert.match(markdown, /smoke: `passed`/);
assert.match(markdown, /terminal\/governance\/terminal-governance-diagnostics\.json/);
assert.match(markdown, /Governance evidence: 1 blocked\/1 total/);
assert.match(markdown, /Restricted/);
assert.match(markdown, /P3/);
assert.match(markdown, /## Coding-server OpenAPI evidence/);
assert.match(markdown, /Canonical snapshot: `server\/windows\/x64\/openapi\/coding-server-v1\.json`/);
assert.match(markdown, /Targets: `windows\/x64`/);
assert.match(markdown, /OpenAPI version: `3\.1\.0`/);
assert.match(markdown, /API version: `v1`/);
assert.match(markdown, /## Quality evidence/);
assert.match(markdown, /quality\/quality-gate-matrix-report\.json/);
assert.match(markdown, /Quality tiers: `fast`, `standard`, `release`/);
assert.match(markdown, /Blocking diagnostics: `vite-host-build-preflight`/);
assert.match(markdown, /Release governance checks: `engine-runtime-adapter`, `engine-conformance`, `tool-protocol`, `engine-resume-recovery`/);
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
assert.match(markdown, /Loop scoreboard: `architecture_alignment=100`, `implementation_completeness=100`, `test_closure=70`, `commercial_readiness=60`/);
assert.match(markdown, /Lowest score item: `commercial_readiness`/);
assert.match(markdown, /Next focus: Clear blocking diagnostics \(`vite-host-build-preflight`\) and rerun quality gates\./);
assert.match(markdown, /## Post-release operations/);
assert.match(markdown, /Observation window: `45` minutes on `ring-1`/);
assert.match(markdown, /Stop-ship signals: quality blockers `vite-host-build-preflight`; governance blocked records `1`/);
assert.match(markdown, /Rollback entry: `gh workflow run rollback\.yml --ref main`/);
assert.match(markdown, /Re-issue path: `pnpm release:plan` -> affected `release:package:\*` \/ `release:smoke:\*` -> `pnpm release:finalize`/);
assert.match(markdown, /Writeback targets: `docs\/release\/releases\.json`/);

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
