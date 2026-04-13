import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createViteHostPlan,
  normalizeViteMode,
  resolveInstalledVitePackageRoot,
  resolveViteCliEntry,
  resolveViteWindowsRealpathPatchEntry,
  shouldSkipViteHostBuildPreflight,
  stripModeArg,
} from './run-vite-host.mjs';

assert.equal(normalizeViteMode('dev'), 'development');
assert.equal(normalizeViteMode('Production'), 'production');
assert.equal(normalizeViteMode('unknown', 'test'), 'test');

assert.deepEqual(stripModeArg(['serve', '--mode', 'production', '--host', '0.0.0.0']), {
  args: ['serve', '--host', '0.0.0.0'],
  explicitMode: 'production',
});

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-vite-host-'));
const vitePackageRoot = path.join(tempRoot, 'node_modules', 'vite');
const viteCliPath = path.join(vitePackageRoot, 'dist', 'node', 'cli.js');
fs.mkdirSync(path.dirname(viteCliPath), { recursive: true });
fs.writeFileSync(
  path.join(tempRoot, 'package.json'),
  JSON.stringify({
    name: '@sdkwork/birdcoder-web',
    private: true,
  }),
  'utf8',
);
fs.writeFileSync(
  path.join(vitePackageRoot, 'package.json'),
  JSON.stringify({
    name: 'vite',
    version: '6.2.0',
    bin: {
      vite: 'dist/node/cli.js',
    },
  }),
  'utf8',
);
fs.writeFileSync(viteCliPath, "console.log('vite-cli');\n", 'utf8');

assert.equal(
  resolveInstalledVitePackageRoot({
    cwd: tempRoot,
    workspaceRootDir: tempRoot,
  }),
  vitePackageRoot,
);
assert.equal(
  resolveViteCliEntry({
    cwd: tempRoot,
    workspaceRootDir: tempRoot,
  }),
  viteCliPath,
);

const devPlan = createViteHostPlan({
  argv: ['--host', '0.0.0.0'],
  env: {},
  cwd: tempRoot,
});
assert.equal(devPlan.args[0], '--import');
assert.equal(devPlan.args[1], resolveViteWindowsRealpathPatchEntry());
assert.equal(devPlan.args[2], viteCliPath);
assert.equal(devPlan.args[3], 'serve');
assert.equal(devPlan.args[5], 'development');
assert.equal(devPlan.args[6], '--configLoader');
assert.equal(devPlan.args[7], 'native');
assert.equal(devPlan.args[8], '--host');
assert.equal(devPlan.args[9], '0.0.0.0');
assert.equal(devPlan.env.SDKWORK_VITE_MODE, 'development');

const buildPlan = createViteHostPlan({
  argv: ['build', '--mode', 'test', '--emptyOutDir'],
  env: {
    SDKWORK_VITE_MODE: 'production',
    CUSTOM_ENV: 'retained',
  },
  cwd: tempRoot,
});
assert.equal(buildPlan.command, process.execPath);
assert.deepEqual(buildPlan.args, [
  '--import',
  resolveViteWindowsRealpathPatchEntry(),
  viteCliPath,
  'build',
  '--mode',
  'test',
  '--configLoader',
  'native',
  '--emptyOutDir',
]);
assert.equal(buildPlan.cwd, tempRoot);
assert.equal(buildPlan.env.SDKWORK_VITE_MODE, 'test');
assert.equal(buildPlan.env.CUSTOM_ENV, 'retained');

const explicitConfigLoaderPlan = createViteHostPlan({
  argv: ['serve', '--configLoader', 'runner'],
  env: {},
  cwd: tempRoot,
});
assert.deepEqual(explicitConfigLoaderPlan.args, [
  '--import',
  resolveViteWindowsRealpathPatchEntry(),
  viteCliPath,
  'serve',
  '--mode',
  'development',
  '--configLoader',
  'runner',
]);

assert.equal(
  shouldSkipViteHostBuildPreflight({
    cwd: tempRoot,
  }),
  true,
);

const nonBirdcoderTempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-vite-host-generic-'));
fs.writeFileSync(
  path.join(nonBirdcoderTempRoot, 'package.json'),
  JSON.stringify({
    name: 'generic-app',
    private: true,
  }),
  'utf8',
);

assert.equal(
  shouldSkipViteHostBuildPreflight({
    cwd: nonBirdcoderTempRoot,
  }),
  false,
);

console.log('run vite host contract passed.');
