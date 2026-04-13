import assert from 'node:assert/strict';
import path from 'node:path';

import {
  buildDesktopReleaseBuildPreflightPlan,
  createDesktopReleaseBuildPlan,
  parseArgs,
} from './run-desktop-release-build.mjs';

const defaults = parseArgs([]);
assert.equal(defaults.profileId, 'sdkwork-birdcoder');
assert.equal(defaults.phase, 'all');
assert.equal(defaults.targetTriple, '');
assert.equal(defaults.releaseMode, false);
assert.equal(defaults.platform, process.platform);
assert.equal(defaults.hostArch, process.arch);
assert.equal(defaults.viteMode, 'production');
assert.deepEqual(defaults.bundleTargets, []);

const configured = parseArgs([
  '--profile', 'sdkwork-birdcoder',
  '--phase', 'bundle',
  '--target', 'x86_64-apple-darwin',
  '--platform', 'darwin',
  '--host-arch', 'arm64',
  '--vite-mode', 'release',
  '--bundles', 'app,dmg',
  '--release',
]);
assert.equal(configured.platform, 'darwin');
assert.equal(configured.hostArch, 'arm64');
assert.equal(configured.viteMode, 'release');
assert.deepEqual(configured.bundleTargets, ['app', 'dmg']);
assert.equal(configured.releaseMode, true);
assert.throws(() => parseArgs(['--unknown']), /Unknown argument/);

const syncPlan = createDesktopReleaseBuildPlan({
  phase: 'sync',
});
assert.equal(syncPlan.command, process.execPath);
assert.match(syncPlan.args.join(' '), /prepare-shared-sdk-packages\.mjs/);
assert.equal(syncPlan.shell, false);

const prepareTargetPlan = createDesktopReleaseBuildPlan({
  phase: 'prepare-target',
});
assert.equal(prepareTargetPlan.command, process.execPath);
assert.equal(prepareTargetPlan.shell, false);

const bundlePlan = createDesktopReleaseBuildPlan({
  phase: 'bundle',
  platform: 'win32',
  targetTriple: 'x86_64-pc-windows-msvc',
});
assert.equal(bundlePlan.command, process.execPath);
assert.deepEqual(
  bundlePlan.args.slice(0, 4),
  [
    'scripts/run-windows-tauri-bundle.mjs',
    '--config',
    'packages/sdkwork-birdcoder-desktop/src-tauri/tauri.conf.json',
    '--vite-mode',
  ],
);
assert.ok(bundlePlan.args.includes('production'));
assert.ok(bundlePlan.args.includes('--target'));
assert.ok(bundlePlan.args.includes('x86_64-pc-windows-msvc'));
assert.equal(bundlePlan.shell, false);

const testBundlePlan = createDesktopReleaseBuildPlan({
  phase: 'bundle',
  platform: 'win32',
  viteMode: 'test',
  targetTriple: 'x86_64-pc-windows-msvc',
});
assert.equal(testBundlePlan.command, process.execPath);
assert.deepEqual(
  testBundlePlan.args.slice(0, 4),
  [
    'scripts/run-windows-tauri-bundle.mjs',
    '--config',
    'packages/sdkwork-birdcoder-desktop/src-tauri/tauri.test.conf.json',
    '--vite-mode',
  ],
);
assert.ok(testBundlePlan.args.includes('test'));
assert.ok(testBundlePlan.args.includes('--target'));
assert.ok(testBundlePlan.args.includes('x86_64-pc-windows-msvc'));
assert.equal(testBundlePlan.shell, false);

const unixBundlePlan = createDesktopReleaseBuildPlan({
  phase: 'bundle',
  platform: 'linux',
  viteMode: 'production',
});
assert.equal(unixBundlePlan.command, process.execPath);
assert.deepEqual(
  unixBundlePlan.args.slice(0, 4),
  [
    'scripts/run-tauri-cli.mjs',
    'build',
    '--config',
    'src-tauri/tauri.conf.json',
  ],
);
assert.equal(
  unixBundlePlan.cwd,
  path.join(path.resolve(import.meta.dirname, '..'), 'packages', 'sdkwork-birdcoder-desktop'),
);
assert.equal(unixBundlePlan.shell, false);

const preflightPlan = buildDesktopReleaseBuildPreflightPlan({
  phase: 'bundle',
});
assert.equal(preflightPlan, null);

console.log('desktop release build contract passed.');
