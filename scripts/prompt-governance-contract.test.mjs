import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const promptPath = path.join(rootDir, 'docs/prompts/反复执行Step指令.md');
const promptSource = fs.readFileSync(promptPath, 'utf8');
const rootPackageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'),
);
const governanceRegressionReportSource = fs.readFileSync(
  path.join(rootDir, 'scripts/governance-regression-report.mjs'),
  'utf8',
);
const releaseFlowRunnerModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/run-release-flow-check.mjs')).href
);
const releaseFlowCommandsJoined = releaseFlowRunnerModule.RELEASE_FLOW_CHECK_COMMANDS.join(' && ');

assert.match(promptSource, /release assets/);
assert.match(promptSource, /`docs\/step\/`/);
assert.match(promptSource, /`docs\/release\/`/);
assert.match(promptSource, /core docs/);
assert.match(promptSource, /\u505c\u6b62\u65e0\u6548\u4ee3\u7801\u4fee\u6539/);
assert.match(promptSource, /\u7f3a\u5931\u80fd\u529b/);
assert.match(promptSource, /\u4e0b\u4e00\u6b65\u547d\u4ee4/);
assert.match(promptSource, /\u672a\u88ab\u963b\u585e\u7684\u4ed3\u5185\u4e8b\u9879/);
assert.match(
  promptSource,
  /historical blocked checkpoints may remain only as checkpoint-local history explicitly superseded by `docs\/release\/release-2026-04-13-04\.md`/,
);
assert.match(
  promptSource,
  /The PostgreSQL host-pass closure is already recorded in `docs\/release\/release-2026-04-13-04\.md`; future DSN-less or driver-less reruns must stay `blocked`, and future DSN-backed runtime connectivity reruns must stay structured `failed` instead of crashing\./,
);
assert.match(
  promptSource,
  /at that checkpoint, the next non-environmental serial slice was the remaining nested `pnpm run` lane inside `check:release-flow`, and the later closure is recorded in `docs\/release\/release-2026-04-13-02\.md`/,
);
assert.match(
  promptSource,
  /later failure-path closure is recorded in `docs\/release\/release-2026-04-13-03\.md`, and the later host-pass closure is recorded in `docs\/release\/release-2026-04-13-04\.md`/,
);
assert.match(
  promptSource,
  /at that checkpoint, the next non-environmental slice had to return to the `09 -> 17` mainline instead of reopening Code page internals; the later Step 17, Step 18, and Step `20` follow-on closures are recorded in `docs\/release\/release-2026-04-13-04\.md`, `docs\/release\/release-2026-04-13-05\.md`, and `docs\/release\/release-2026-04-13-08\.md`/,
);
assert.doesNotMatch(
  promptSource,
  /A real PostgreSQL closure still requires a DSN-backed `passed` run/,
);
assert.doesNotMatch(promptSource, /remains the sole Step 17 environment gate/);
assert.doesNotMatch(promptSource, /remains the active environment gate/);
assert.doesNotMatch(
  promptSource,
  /the next non-environmental serial slice is the remaining nested `pnpm run` lane inside `check:release-flow`/,
);
assert.doesNotMatch(
  promptSource,
  /the active lowest-score item returns to DSN-backed PostgreSQL live smoke/,
);
assert.doesNotMatch(
  promptSource,
  /a real commercial-readiness closure still requires a DSN-backed `passed` report/,
);
assert.doesNotMatch(
  promptSource,
  /commercial-readiness should now move to the next lowest-score item instead of treating PostgreSQL environment availability as the active blocker on this host/,
);
assert.doesNotMatch(
  promptSource,
  /the next non-environmental slice must return to the `09 -> 17` mainline instead of reopening Code page internals/,
);

assert.equal(rootPackageJson.scripts['check:release-flow'], 'node scripts/run-release-flow-check.mjs');
assert.match(releaseFlowCommandsJoined, /prompt-governance-contract\.test\.mjs/);

assert.match(governanceRegressionReportSource, /id:\s*'step-loop-prompt-governance'/);
assert.match(
  governanceRegressionReportSource,
  /command:\s*'node scripts\/prompt-governance-contract\.test\.mjs'/,
);

console.log('prompt governance contract passed.');
