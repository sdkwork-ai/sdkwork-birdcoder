import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createTauriCliPlan } from './run-tauri-cli.mjs';

const modulePath = path.resolve(import.meta.dirname, 'run-tauri-cli.mjs');

const defaultPlan = createTauriCliPlan({
  argv: ['dev'],
  env: {},
  platform: 'linux',
  execPath: '/usr/bin/node',
  resolveTauriCliEntrypoint: () => '/workspace/sdkwork-birdcoder/node_modules/@tauri-apps/cli/tauri.js',
});

assert.equal(defaultPlan.command, '/usr/bin/node');
assert.deepEqual(defaultPlan.args, ['/workspace/sdkwork-birdcoder/node_modules/@tauri-apps/cli/tauri.js', 'dev']);
assert.equal(defaultPlan.env.SDKWORK_VITE_MODE, 'development');
assert.equal(defaultPlan.shell, false);

const testPlan = createTauriCliPlan({
  argv: ['dev', '--config', 'src-tauri/tauri.test.conf.json', '--vite-mode', 'test'],
  env: {},
  platform: 'win32',
  cwd: 'D:\\workspace\\sdkwork-birdcoder\\packages\\sdkwork-birdcoder-desktop',
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
  testPlan.env.BIRDCODER_CODING_SERVER_SQLITE_FILE,
  'D:\\workspace\\sdkwork-birdcoder\\packages\\sdkwork-birdcoder-desktop\\.local\\sdkwork-birdcoder.sqlite3',
);
assert.equal(testPlan.shell, false);

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
