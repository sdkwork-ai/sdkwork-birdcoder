import assert from 'node:assert/strict';
import process from 'node:process';

import {
  buildServerBuildPlan,
  parseArgs,
  runServerBuild,
} from './run-birdcoder-server-build.mjs';

const defaults = parseArgs([]);
assert.equal(defaults.targetTriple, '');
assert.throws(() => parseArgs(['--unknown']), /Unknown argument/);

const configured = parseArgs(['--target', 'x86_64-unknown-linux-gnu']);
assert.equal(configured.targetTriple, 'x86_64-unknown-linux-gnu');

const defaultPlan = buildServerBuildPlan();
assert.equal(defaultPlan.command, 'cargo');
assert.equal(defaultPlan.args[0], 'build');
assert.equal(defaultPlan.args[1], '--manifest-path');
assert.match(
  defaultPlan.args[2],
  /packages[\\/]+sdkwork-birdcoder-server[\\/]+src-host[\\/]+Cargo\.toml$/,
);
assert.ok(defaultPlan.args.includes('--release'));
assert.equal(defaultPlan.cwd, process.cwd());
assert.equal(defaultPlan.shell, false);

const targetedPlan = buildServerBuildPlan({
  targetTriple: 'x86_64-unknown-linux-gnu',
});
assert.deepEqual(targetedPlan.args.slice(-2), ['--target', 'x86_64-unknown-linux-gnu']);

assert.equal(typeof runServerBuild, 'function');

console.log('birdcoder server build contract passed.');
