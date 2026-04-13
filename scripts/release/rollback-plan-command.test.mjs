import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runLocalReleaseCommand } from './local-release-command.mjs';

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-rollback-cli-'));
const manifestPath = path.join(releaseAssetsDir, 'release-manifest.json');

fs.writeFileSync(
  manifestPath,
  JSON.stringify({
    generatedAt: '2026-04-09T12:30:00.000Z',
    checksumFileName: 'SHA256SUMS.txt',
    assets: [
      { family: 'desktop', platform: 'windows', arch: 'x64' },
      { family: 'server', platform: 'linux', arch: 'x64' },
    ],
  }, null, 2),
);

const stdoutChunks = [];
const rollbackPlan = runLocalReleaseCommand(
  [
    'rollback-plan',
    '--release-assets-dir',
    releaseAssetsDir,
    '--',
    '--release-tag',
    'release-2026-04-09-107',
  ],
  {
    write: (chunk) => {
      stdoutChunks.push(String(chunk));
    },
  },
);
const stdout = stdoutChunks.join('');

assert.equal(rollbackPlan.releaseTag, 'release-2026-04-09-107');
assert.equal(rollbackPlan.hasFinalizedManifest, true);
assert.equal(rollbackPlan.manifestPath, manifestPath);
assert.equal(rollbackPlan.releaseControl.releaseKind, 'rollback');
assert.equal(rollbackPlan.finalizedRelease.assetCount, 2);
assert.deepEqual(rollbackPlan.finalizedRelease.assetFamilies, ['desktop', 'server']);
assert.match(
  rollbackPlan.rollbackExecution.command,
  /pnpm release:rollback:plan -- --release-tag release-2026-04-09-107 --release-assets-dir/,
);
assert.deepEqual(JSON.parse(stdout), rollbackPlan);

const rootPackageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
assert.match(rootPackageJson.scripts['check:release-flow'], /rollback-plan-command\.test\.mjs/);
const governanceRegressionSource = fs.readFileSync(
  path.join(process.cwd(), 'scripts/governance-regression-report.mjs'),
  'utf8',
);
assert.match(governanceRegressionSource, /release-rollback-plan-command/);
assert.match(governanceRegressionSource, /rollback-plan-command\.test\.mjs/);

fs.rmSync(releaseAssetsDir, { recursive: true, force: true });

console.log('rollback plan command contract passed.');
