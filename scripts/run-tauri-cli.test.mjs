import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  createTauriCliPlan,
  resolveDesktopApplicationRootEnv,
} from './run-tauri-cli.mjs';

const modulePath = path.resolve(import.meta.dirname, 'run-tauri-cli.mjs');
const passthroughPostgresProfile = ({ env }) => ({ env: { ...env } });

let postgresProfileRequest;

const defaultPlan = createTauriCliPlan({
  argv: ['dev'],
  env: {},
  platform: 'linux',
  execPath: '/usr/bin/node',
  resolvePostgresProfile: (request) => {
    postgresProfileRequest = request;
    return {
      env: {
        ...request.env,
        SDKWORK_DATABASE_SCHEMA: 'sdkwork_ai_dev',
      },
    };
  },
  resolveTauriCliEntrypoint: () => '/workspace/sdkwork-birdcoder/node_modules/@tauri-apps/cli/tauri.js',
});

assert.equal(defaultPlan.command, '/usr/bin/node');
assert.deepEqual(defaultPlan.args, ['/workspace/sdkwork-birdcoder/node_modules/@tauri-apps/cli/tauri.js', 'dev']);
assert.equal(defaultPlan.env.SDKWORK_VITE_MODE, 'development');
assert.equal(defaultPlan.env.SDKWORK_DATABASE_SCHEMA, 'sdkwork_ai_dev');
assert.equal(postgresProfileRequest.repoRoot, path.resolve(import.meta.dirname, '..'));
assert.equal(defaultPlan.shell, false);

let cloudPostgresProfileCalled = false;
const cloudPlan = createTauriCliPlan({
  argv: ['dev'],
  env: {
    SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE: 'cloud',
  },
  platform: 'linux',
  execPath: '/usr/bin/node',
  resolvePostgresProfile: () => {
    cloudPostgresProfileCalled = true;
    return { env: {} };
  },
  resolveTauriCliEntrypoint: () => '/workspace/sdkwork-birdcoder/node_modules/@tauri-apps/cli/tauri.js',
});

assert.equal(cloudPostgresProfileCalled, false);
assert.equal(cloudPlan.env.SDKWORK_DATABASE_URL, undefined);

assert.deepEqual(
  resolveDesktopApplicationRootEnv({
    env: {
      SDKWORK_APP_ROOT: '.',
      SDKWORK_BIRDCODER_APP_ROOT: './apps/..',
    },
    platform: 'win32',
    workspaceRootDir: 'D:\\workspace\\sdkwork-birdcoder',
  }),
  {
    SDKWORK_APP_ROOT: 'D:\\workspace\\sdkwork-birdcoder',
    SDKWORK_BIRDCODER_APP_ROOT: 'D:\\workspace\\sdkwork-birdcoder',
  },
  'desktop application roots from source profiles must resolve against the repository root',
);

assert.deepEqual(
  resolveDesktopApplicationRootEnv({
    env: {
      SDKWORK_APP_ROOT: '/opt/sdkwork/birdcoder',
      SDKWORK_BIRDCODER_APP_ROOT: '',
    },
    platform: 'linux',
    workspaceRootDir: '/workspace/sdkwork-birdcoder',
  }),
  {
    SDKWORK_APP_ROOT: '/opt/sdkwork/birdcoder',
  },
  'absolute application roots must remain absolute and blank overrides must stay absent',
);

const testPlan = createTauriCliPlan({
  argv: ['dev', '--config', 'src-tauri/tauri.test.conf.json', '--vite-mode', 'test'],
  env: {
    SDKWORK_APP_ROOT: '.',
    SDKWORK_BIRDCODER_APP_ROOT: '.',
  },
  platform: 'win32',
  cwd: 'D:\\workspace\\sdkwork-birdcoder\\packages\\sdkwork-birdcoder-pc-desktop',
  execPath: 'C:\\Program Files\\nodejs\\node.exe',
  resolveTauriCliEntrypoint: () => 'D:\\workspace\\sdkwork-birdcoder\\node_modules\\@tauri-apps\\cli\\tauri.js',
});

assert.equal(testPlan.command, 'C:\\Program Files\\nodejs\\node.exe');
assert.deepEqual(
  testPlan.args,
  ['D:\\workspace\\sdkwork-birdcoder\\node_modules\\@tauri-apps\\cli\\tauri.js', 'dev', '--config', 'src-tauri/tauri.test.conf.json'],
);
assert.equal(testPlan.env.SDKWORK_VITE_MODE, 'test');
assert.equal(
  testPlan.env.SDKWORK_APP_ROOT,
  path.resolve(import.meta.dirname, '..'),
);
assert.equal(
  testPlan.env.SDKWORK_BIRDCODER_APP_ROOT,
  path.resolve(import.meta.dirname, '..'),
);
assert.equal(
  testPlan.env.SDKWORK_BIRDCODER_DEVICE_STATE_FILE,
  'D:\\workspace\\sdkwork-birdcoder\\packages\\sdkwork-birdcoder-pc-desktop\\.local\\birdcoder-device-state.sqlite3',
);
assert.equal(testPlan.shell, false);

const linuxDesktopPlan = createTauriCliPlan({
  argv: ['dev'],
  env: {},
  platform: 'linux',
  cwd: '/home/runner/work/sdkwork-birdcoder/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop',
  execPath: '/usr/bin/node',
  resolvePostgresProfile: passthroughPostgresProfile,
  resolveTauriCliEntrypoint: () => '/home/runner/work/sdkwork-birdcoder/sdkwork-birdcoder/node_modules/@tauri-apps/cli/tauri.js',
});

assert.equal(
  linuxDesktopPlan.env.SDKWORK_BIRDCODER_DEVICE_STATE_FILE,
  '/home/runner/work/sdkwork-birdcoder/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/.local/birdcoder-device-state.sqlite3',
  'desktop dev device-state fallback should use the target platform path model instead of the host OS path model',
);

assert.match(
  readFileSync(modulePath, 'utf8'),
  /SDKWORK_BIRDCODER_DEVICE_STATE_FILE/u,
  'tauri dev runner must publish the canonical desktop device-state override.',
);

assert.throws(
  () => createTauriCliPlan({
    argv: ['build', '--vite-mode'],
    env: {},
    platform: 'linux',
  }),
  /Missing value for --vite-mode/,
);

assert.throws(
  () => createTauriCliPlan({
    argv: ['info'],
    env: {},
    platform: 'linux',
    resolveTauriCliEntrypoint: () => '',
  }),
  /Unable to resolve the local @tauri-apps\/cli entrypoint/,
);

assert.match(
  readFileSync(modulePath, 'utf8'),
  /if \(path\.resolve\(process\.argv\[1\] \?\? ''\) === __filename\) \{\s*try \{\s*runCli\(\);\s*\} catch \(error\) \{\s*console\.error\(error instanceof Error \? error\.message : String\(error\)\);\s*process\.exit\(1\);\s*\}\s*\}/s,
);

console.log('ok - tauri cli runner resolves the local workspace CLI and forwards vite mode through the tauri process environment');
