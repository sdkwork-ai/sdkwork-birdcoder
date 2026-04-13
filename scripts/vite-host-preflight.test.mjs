import assert from 'node:assert/strict';

import {
  formatViteHostPreflightFailure,
  runViteHostBuildPreflight,
} from './vite-host-preflight.mjs';

const skippedReport = runViteHostBuildPreflight({
  platform: 'linux',
});
assert.equal(skippedReport.ok, true);
assert.equal(skippedReport.status, 'skipped');
assert.equal(skippedReport.checks.length, 0);

const successfulReport = runViteHostBuildPreflight({
  platform: 'win32',
  shellPath: 'C:\\Windows\\System32\\cmd.exe',
  esbuildBinaryPath: 'D:\\repo\\node_modules\\@esbuild\\win32-x64\\esbuild.exe',
  spawnSyncImpl(command, args) {
    return {
      command,
      args,
      status: 0,
      signal: null,
      stdout: '',
      stderr: '',
      error: null,
    };
  },
});
assert.equal(successfulReport.ok, true);
assert.equal(successfulReport.status, 'passed');
assert.equal(successfulReport.checks.length, 2);
assert.deepEqual(
  successfulReport.checks.map((check) => check.id),
  ['shell-exec', 'esbuild-binary'],
);

const blockedReport = runViteHostBuildPreflight({
  platform: 'win32',
  shellPath: 'C:\\Windows\\System32\\cmd.exe',
  esbuildBinaryPath: 'D:\\repo\\node_modules\\@esbuild\\win32-x64\\esbuild.exe',
  spawnSyncImpl(command) {
    return {
      status: null,
      signal: null,
      stdout: '',
      stderr: '',
      error: {
        code: 'EPERM',
        errno: -4048,
        syscall: `spawnSync ${command}`,
      },
    };
  },
});
assert.equal(blockedReport.ok, false);
assert.equal(blockedReport.status, 'failed');
assert.equal(blockedReport.checks.length, 2);
assert.deepEqual(
  blockedReport.checks.map((check) => check.status),
  ['failed', 'failed'],
);

const formattedFailure = formatViteHostPreflightFailure(blockedReport);
assert.match(formattedFailure, /toolchain-platform/u);
assert.match(formattedFailure, /cmd\.exe/u);
assert.match(formattedFailure, /esbuild\.exe/u);
assert.match(formattedFailure, /spawn EPERM/u);

console.log('vite host preflight contract passed.');
