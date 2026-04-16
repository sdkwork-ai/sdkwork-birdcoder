import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { renderReleaseNotes } from './render-release-notes.mjs';

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-notes-docs-'));
const docsDir = path.join(fixtureRoot, 'docs', 'release');
const releaseAssetsDir = path.join(fixtureRoot, 'release-assets');
fs.mkdirSync(docsDir, { recursive: true });
fs.mkdirSync(releaseAssetsDir, { recursive: true });
fs.writeFileSync(
  path.join(docsDir, 'releases.json'),
  JSON.stringify({
    schemaVersion: 2,
    generatedAt: '2026-04-08T00:00:00.000Z',
    releases: [
      {
        tag: 'release-2026-04-08-00',
        title: 'SDKWork BirdCoder release-2026-04-08-00',
        date: '2026-04-08',
        status: 'draft',
        summary: 'Earlier unpublished tag.',
        notesFile: 'release-2026-04-08-00.md',
        stopShipSignals: ['governance blockers `manual-approval-missing`'],
        promotionReadiness: {
          currentReleaseKind: 'canary',
          currentRolloutStage: 'ring-0',
          formalOrGaStatus: 'blocked',
          stopShipSignals: ['governance blockers `manual-approval-missing`'],
        },
      },
      {
        tag: 'release-2026-04-08-01',
        title: 'SDKWork BirdCoder release-2026-04-08-01',
        date: '2026-04-08',
        status: 'pending',
        summary: 'Docs-backed release note source.',
        notesFile: 'release-2026-04-08-01.md',
        carryForward: ['release-2026-04-08-00'],
      },
    ],
  }, null, 2),
);
fs.writeFileSync(
  path.join(docsDir, 'release-2026-04-08-00.md'),
  '## Earlier Highlights\n\n- Carried forward release note body.\n',
);
fs.writeFileSync(
  path.join(docsDir, 'release-2026-04-08-01.md'),
  '## Highlights\n\n- Docs registry note wins.\n',
);
fs.writeFileSync(
  path.join(releaseAssetsDir, 'release-manifest.json'),
  JSON.stringify({
    generatedAt: '2026-04-08T00:00:00.000Z',
    assets: [],
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
      manifestBoundTiers: 3,
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
      releaseReadinessSignals: ['desktop local project recovery `windows/x64` is `not-ready`'],
    },
  }, null, 2),
);

const outputPath = path.join(fixtureRoot, 'release-notes.md');
renderReleaseNotes({
  profile: 'sdkwork-birdcoder',
  'release-tag': 'release-2026-04-08-01',
  'docs-dir': docsDir,
  'release-assets-dir': releaseAssetsDir,
  output: outputPath,
});

const rendered = fs.readFileSync(outputPath, 'utf8');
assert.match(rendered, /SDKWork BirdCoder release-2026-04-08-01/);
assert.match(rendered, /Docs-backed release note source/);
assert.match(rendered, /Finalized release readiness: `blocked`/);
assert.match(
  rendered,
  /Finalized readiness signals: quality blockers `vite-host-build-preflight`; desktop local project recovery `windows\/x64` is `not-ready`/,
);
assert.match(rendered, /Docs registry note wins/);
assert.match(rendered, /Carried Forward From Earlier Unpublished Tags/);
assert.match(rendered, /release-2026-04-08-00/);
assert.match(rendered, /Carried forward release note body/);
assert.match(rendered, /## Finalized Release Evidence/);
assert.match(rendered, /## Coding-server OpenAPI evidence/);
assert.match(rendered, /Canonical snapshot: `server\/windows\/x64\/openapi\/coding-server-v1\.json`/);
assert.match(rendered, /## Quality evidence/);
assert.match(rendered, /Manifest-bound tiers: `3\/3`/);
assert.match(rendered, /Blocking diagnostics: `vite-host-build-preflight`/);
assert.match(rendered, /Required host capabilities for `vite-host-build-preflight`: `cmd\.exe shell execution`, `esbuild\.exe process launch`/);
assert.match(rendered, /Rerun sequence for `vite-host-build-preflight`: `pnpm check:quality:standard` -> `pnpm check:quality:release`/);
assert.match(rendered, /## Post-release operations/);
assert.match(rendered, /Observation window: `0` minutes on `pending`/);
assert.match(rendered, /Rollback entry: `pnpm release:rollback:plan -- --release-tag release-2026-04-08-01 --release-assets-dir /);
assert.match(rendered, /Writeback targets: `.*releases\.json` and `.*release-2026-04-08-01\.md`/);
const updatedRegistry = JSON.parse(fs.readFileSync(path.join(docsDir, 'releases.json'), 'utf8'));
assert.equal(updatedRegistry.schemaVersion, 2);
assert.equal(updatedRegistry.generatedAt, '2026-04-08T00:00:00.000Z');
assert.deepEqual(updatedRegistry.releases[0].stopShipSignals, [
  'governance blockers `manual-approval-missing`',
]);
assert.deepEqual(updatedRegistry.releases[0].promotionReadiness, {
  currentReleaseKind: 'canary',
  currentRolloutStage: 'ring-0',
  formalOrGaStatus: 'blocked',
  stopShipSignals: [
    'governance blockers `manual-approval-missing`',
  ],
});
assert.deepEqual(updatedRegistry.releases[1].stopShipSignals, [
  'quality blockers `vite-host-build-preflight`',
]);
assert.deepEqual(updatedRegistry.releases[1].promotionReadiness, {
  currentReleaseKind: '',
  currentRolloutStage: '',
  formalOrGaStatus: 'blocked',
  stopShipSignals: [
    'quality blockers `vite-host-build-preflight`',
  ],
});

const missingQualityReleaseAssetsDir = path.join(fixtureRoot, 'release-assets-missing-quality');
fs.mkdirSync(missingQualityReleaseAssetsDir, { recursive: true });
fs.writeFileSync(
  path.join(missingQualityReleaseAssetsDir, 'release-manifest.json'),
  JSON.stringify({
    generatedAt: '2026-04-08T00:00:00.000Z',
    assets: [],
  }, null, 2),
);
assert.throws(
  () => renderReleaseNotes({
    profile: 'sdkwork-birdcoder',
    'release-tag': 'release-2026-04-08-01',
    'docs-dir': docsDir,
    'release-assets-dir': missingQualityReleaseAssetsDir,
  }),
  /Missing finalized manifest qualityEvidence summary/,
);
assert.throws(
  () => renderReleaseNotes({
    profile: 'sdkwork-birdcoder',
    'release-tag': 'release-2026-04-08-99',
    'docs-dir': docsDir,
  }),
  /No release document metadata found for release-2026-04-08-99/,
);

console.log('render release notes docs registry contract passed.');
