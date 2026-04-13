import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createRollbackPlan,
  createReleasePlan,
  parseArgs,
  writeGitHubOutput,
} from './resolve-release-plan.mjs';

assert.deepEqual(parseArgs([]), {
  profileId: 'sdkwork-birdcoder',
  releaseTag: '',
  gitRef: '',
  releaseKind: 'formal',
  rolloutStage: '',
  monitoringWindowMinutes: 0,
  rollbackRunbookRef: '',
  rollbackCommand: '',
  githubOutput: false,
});
assert.throws(() => parseArgs(['--profile']), /Missing value for --profile/);

const parsed = parseArgs([
  '--profile',
  'sdkwork-birdcoder',
  '--release-tag',
  'release-2026-04-09-93',
  '--git-ref',
  'refs/heads/main',
  '--release-kind',
  'canary',
  '--rollout-stage',
  'ring-1',
  '--monitoring-window-minutes',
  '45',
  '--rollback-runbook-ref',
  'docs/step/13-发布就绪-github-flow-灰度回滚闭环.md',
  '--rollback-command',
  'gh workflow run rollback.yml --ref main',
  '--github-output',
]);
assert.equal(parsed.profileId, 'sdkwork-birdcoder');
assert.equal(parsed.releaseTag, 'release-2026-04-09-93');
assert.equal(parsed.gitRef, 'refs/heads/main');
assert.equal(parsed.releaseKind, 'canary');
assert.equal(parsed.rolloutStage, 'ring-1');
assert.equal(parsed.monitoringWindowMinutes, 45);
assert.equal(parsed.rollbackRunbookRef, 'docs/step/13-发布就绪-github-flow-灰度回滚闭环.md');
assert.equal(parsed.rollbackCommand, 'gh workflow run rollback.yml --ref main');
assert.equal(parsed.githubOutput, true);

assert.throws(() => createReleasePlan(), /releaseTag is required/);

const plan = createReleasePlan({
  releaseTag: 'release-2026-04-09-93',
});
assert.equal(plan.profileId, 'sdkwork-birdcoder');
assert.equal(plan.productName, 'SDKWork BirdCoder');
assert.equal(plan.releaseTag, 'release-2026-04-09-93');
assert.equal(plan.gitRef, 'refs/tags/release-2026-04-09-93');
assert.equal(plan.releaseName, 'SDKWork BirdCoder release-2026-04-09-93');
assert.deepEqual(plan.releaseControl, {
  releaseKind: 'formal',
  rolloutStage: 'general-availability',
  monitoringWindowMinutes: 120,
  rollbackRunbookRef: 'docs/step/13-发布就绪-github-flow-灰度回滚闭环.md',
  rollbackCommand: '',
});
assert.ok(plan.desktopMatrix.length > 0);
assert.ok(plan.serverMatrix.length > 0);
assert.ok(plan.containerMatrix.length > 0);
assert.ok(plan.kubernetesMatrix.length > 0);

const canaryPlan = createReleasePlan({
  releaseTag: 'release-2026-04-09-93',
  releaseKind: 'canary',
  rolloutStage: 'ring-1',
  monitoringWindowMinutes: 45,
  rollbackRunbookRef: 'docs/runbooks/canary-rollback.md',
  rollbackCommand: 'gh workflow run rollback.yml --ref main',
});
assert.deepEqual(canaryPlan.releaseControl, {
  releaseKind: 'canary',
  rolloutStage: 'ring-1',
  monitoringWindowMinutes: 45,
  rollbackRunbookRef: 'docs/runbooks/canary-rollback.md',
  rollbackCommand: 'gh workflow run rollback.yml --ref main',
});

const githubOutputPath = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-plan-')),
  'github-output.txt',
);
writeGitHubOutput(canaryPlan, {
  env: {
    GITHUB_OUTPUT: githubOutputPath,
  },
});
const output = fs.readFileSync(githubOutputPath, 'utf8');
assert.match(output, /profile_id=sdkwork-birdcoder/);
assert.match(output, /release_tag=release-2026-04-09-93/);
assert.match(output, /git_ref=refs\/tags\/release-2026-04-09-93/);
assert.match(output, /release_kind=canary/);
assert.match(output, /rollout_stage=ring-1/);
assert.match(output, /monitoring_window_minutes=45/);
assert.match(output, /rollback_runbook_ref=docs\/runbooks\/canary-rollback\.md/);
assert.match(output, /rollback_command=gh workflow run rollback\.yml --ref main/);
assert.match(output, /desktop_matrix=\[/);

assert.throws(() => writeGitHubOutput(plan, { env: {} }), /GITHUB_OUTPUT is required/);

const rollbackAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-rollback-plan-'));
fs.writeFileSync(
  path.join(rollbackAssetsDir, 'release-manifest.json'),
  JSON.stringify({
    generatedAt: '2026-04-09T12:00:00.000Z',
    checksumFileName: 'SHA256SUMS.txt',
    assets: [
      { family: 'desktop', platform: 'windows', arch: 'x64' },
      { family: 'server', platform: 'linux', arch: 'x64' },
    ],
  }, null, 2),
);

const rollbackPlan = createRollbackPlan({
  releaseTag: 'release-2026-04-09-105',
  releaseAssetsDir: rollbackAssetsDir,
  rolloutStage: 'ring-rollback',
  rollbackCommand: 'gh workflow run rollback.yml --ref main',
});
assert.equal(rollbackPlan.profileId, 'sdkwork-birdcoder');
assert.equal(rollbackPlan.releaseTag, 'release-2026-04-09-105');
assert.equal(rollbackPlan.releaseControl.releaseKind, 'rollback');
assert.equal(rollbackPlan.releaseControl.rolloutStage, 'ring-rollback');
assert.equal(rollbackPlan.releaseControl.monitoringWindowMinutes, 30);
assert.equal(rollbackPlan.finalizedRelease.assetCount, 2);
assert.deepEqual(rollbackPlan.finalizedRelease.assetFamilies, ['desktop', 'server']);
assert.equal(rollbackPlan.finalizedRelease.generatedAt, '2026-04-09T12:00:00.000Z');
assert.equal(rollbackPlan.rollbackExecution.command, 'gh workflow run rollback.yml --ref main');
assert.deepEqual(
  rollbackPlan.preflightChecks.map((entry) => entry.id),
  ['quality-fast', 'release-smoke-finalized'],
);
assert.match(
  rollbackPlan.preflightChecks[1].command,
  /pnpm release:smoke:finalized -- --release-assets-dir/,
);

fs.rmSync(path.dirname(githubOutputPath), { recursive: true, force: true });
fs.rmSync(rollbackAssetsDir, { recursive: true, force: true });

console.log('resolve release plan contract passed.');
