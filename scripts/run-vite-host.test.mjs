import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  applyViteHostBuildRuntimeEnv,
  createViteHostPlan,
  normalizeViteMode,
  resolveInstalledVitePackageRoot,
  resolveWorkspaceRootDir,
  shouldEnforceViteHostBuildPreflight,
  resolveViteCliEntry,
  resolveViteWindowsRealpathPatchEntry,
  stripCwdArg,
  stripModeArg,
} from './run-vite-host.mjs';

assert.equal(normalizeViteMode('dev'), 'development');
assert.equal(normalizeViteMode('Production'), 'production');
assert.equal(normalizeViteMode('unknown', 'test'), 'test');

assert.deepEqual(stripModeArg(['serve', '--mode', 'production', '--host', '0.0.0.0']), {
  args: ['serve', '--host', '0.0.0.0'],
  explicitMode: 'production',
});
assert.deepEqual(stripCwdArg(['--cwd', 'packages/sdkwork-birdcoder-web', 'build', '--mode', 'production']), {
  args: ['build', '--mode', 'production'],
  explicitCwd: 'packages/sdkwork-birdcoder-web',
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

const explicitCwdPlan = createViteHostPlan({
  argv: ['--cwd', 'packages/sdkwork-birdcoder-web', 'build', '--mode', 'production'],
  env: {},
});
assert.equal(
  explicitCwdPlan.cwd,
  path.join(resolveWorkspaceRootDir(), 'packages', 'sdkwork-birdcoder-web'),
);

const workspaceRootPackageJsonPath = path.resolve('package.json');
const workspaceRootPackageJson = JSON.parse(fs.readFileSync(workspaceRootPackageJsonPath, 'utf8'));
const aliasedBuildPlan = createViteHostPlan({
  argv: ['build', '--mode', 'production'],
  env: {
    CUSTOM_ENV: 'retained',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'safe.directory',
    GIT_CONFIG_VALUE_0: tempRoot,
    GIT_PAGER: 'more.com',
    PAGER: 'more.com',
    npm_command: 'run-script',
    npm_lifecycle_event: 'build:prod',
    npm_lifecycle_script: 'pnpm run build:prod',
  },
  cwd: tempRoot,
});
assert.equal(aliasedBuildPlan.env.CUSTOM_ENV, 'retained');
assert.equal(aliasedBuildPlan.env.npm_lifecycle_event, 'build');
assert.equal(aliasedBuildPlan.env.npm_lifecycle_script, workspaceRootPackageJson.scripts.build);
assert.equal(aliasedBuildPlan.env.INIT_CWD, path.resolve('.'));
assert.equal(aliasedBuildPlan.env.PNPM_SCRIPT_SRC_DIR, path.resolve('.'));
assert.equal(aliasedBuildPlan.env.NODE, process.execPath);
assert.equal(aliasedBuildPlan.env.npm_node_execpath, process.execPath);
assert.equal(aliasedBuildPlan.env.npm_package_json, workspaceRootPackageJsonPath);
assert.equal(aliasedBuildPlan.env.npm_package_name, workspaceRootPackageJson.name);
assert.equal(aliasedBuildPlan.env.npm_package_version, workspaceRootPackageJson.version);
assert.equal(aliasedBuildPlan.env.GIT_CONFIG_COUNT, undefined);
assert.equal(aliasedBuildPlan.env.GIT_CONFIG_KEY_0, undefined);
assert.equal(aliasedBuildPlan.env.GIT_CONFIG_VALUE_0, undefined);
assert.equal(aliasedBuildPlan.env.GIT_PAGER, undefined);
assert.equal(aliasedBuildPlan.env.PAGER, undefined);

const runtimeEnv = {
  CUSTOM_ENV: 'retained',
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'safe.directory',
  GIT_CONFIG_VALUE_0: tempRoot,
  GIT_PAGER: 'more.com',
  PAGER: 'more.com',
  npm_lifecycle_event: 'build:prod',
  npm_lifecycle_script: 'pnpm run build:prod',
};
const normalizedRuntimeEnv = applyViteHostBuildRuntimeEnv({
  env: runtimeEnv,
  viteCommand: 'build',
  workspaceRootDir: path.resolve('.'),
  nodeExecPath: process.execPath,
  rootPackageJson: workspaceRootPackageJson,
});
assert.equal(normalizedRuntimeEnv, runtimeEnv);
assert.equal(runtimeEnv.CUSTOM_ENV, 'retained');
assert.equal(runtimeEnv.npm_lifecycle_event, 'build');
assert.equal(runtimeEnv.npm_lifecycle_script, workspaceRootPackageJson.scripts.build);
assert.equal(runtimeEnv.GIT_CONFIG_COUNT, undefined);
assert.equal(runtimeEnv.GIT_CONFIG_KEY_0, undefined);
assert.equal(runtimeEnv.GIT_CONFIG_VALUE_0, undefined);
assert.equal(runtimeEnv.GIT_PAGER, undefined);
assert.equal(runtimeEnv.PAGER, undefined);

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
  shouldEnforceViteHostBuildPreflight({
    env: {},
  }),
  false,
);

assert.equal(
  shouldEnforceViteHostBuildPreflight({
    env: {
      SDKWORK_ENFORCE_VITE_HOST_PREFLIGHT: '1',
    },
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

assert.equal(shouldEnforceViteHostBuildPreflight({ env: {} }), false);

console.log('run vite host contract passed.');
