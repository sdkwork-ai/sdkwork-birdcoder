import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { renderReleaseNotes } from './render-release-notes.mjs';

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-notes-claw-'));
const releaseAssetsDir = path.join(fixtureRoot, 'assets');
fs.mkdirSync(releaseAssetsDir, { recursive: true });
fs.writeFileSync(
  path.join(releaseAssetsDir, 'release-manifest.json'),
  JSON.stringify({
    generatedAt: '2026-04-08T00:00:00.000Z',
    releaseControl: {
      releaseKind: 'formal',
      rolloutStage: 'general-availability',
      monitoringWindowMinutes: 120,
      rollbackRunbookRef: 'docs/step/13-发布就绪-github-flow-灰度回滚闭环.md',
      rollbackCommand: '',
    },
    assets: [
      {
        family: 'desktop',
        file: 'desktop/windows/x64/sdkwork-birdcoder-desktop-release-local-windows-x64.tar.gz',
        platform: 'windows',
        arch: 'x64',
        desktopStartupSmoke: { status: 'passed' },
      },
    ],
    qualityEvidence: {
      archiveRelativePath: 'quality/quality-gate-matrix-report.json',
      totalTiers: 3,
      workflowBoundTiers: 3,
      tierIds: ['fast', 'standard', 'release'],
      failureClassificationIds: ['contract-drift', 'toolchain-platform', 'artifact-integrity', 'evidence-gap'],
      environmentDiagnostics: 1,
      blockingDiagnosticIds: ['vite-host-build-preflight'],
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
    },
  }, null, 2),
);

const outputPath = path.join(releaseAssetsDir, 'release-notes.md');
renderReleaseNotes({
  profile: 'sdkwork-birdcoder',
  'release-tag': 'release-local',
  output: outputPath,
});

const rendered = fs.readFileSync(outputPath, 'utf8');
assert.match(rendered, /desktop/);
assert.match(rendered, /Finalized at: 2026-04-08T00:00:00.000Z/);
assert.match(rendered, /Release kind: `formal`/);
assert.match(rendered, /Rollout stage: `general-availability`/);
assert.match(rendered, /## Quality evidence/);
assert.match(rendered, /Blocking diagnostics: `vite-host-build-preflight`/);
assert.match(rendered, /Required host capabilities for `vite-host-build-preflight`: `cmd\.exe shell execution`, `esbuild\.exe process launch`/);
assert.match(rendered, /Rerun sequence for `vite-host-build-preflight`: `pnpm check:quality:standard` -> `pnpm check:quality:release`/);
assert.match(rendered, /## Post-release operations/);
assert.match(rendered, /Observation window: `120` minutes on `general-availability`/);
assert.match(rendered, /Rollback entry: `pnpm release:rollback:plan -- --release-tag release-local --release-assets-dir /);
assert.match(rendered, /Writeback targets: `docs\/release\/releases\.json`/);

console.log('render release notes claw invocation contract passed.');
