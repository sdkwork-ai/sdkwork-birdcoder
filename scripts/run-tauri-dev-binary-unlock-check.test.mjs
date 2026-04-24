import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';

import {
  createTauriDevBinaryUnlockCheckPlan,
  resolveWindowsPowerShellExecutablePath,
  runTauriDevBinaryUnlockCheck,
} from './run-tauri-dev-binary-unlock-check.mjs';

{
  const resolvedPath = resolveWindowsPowerShellExecutablePath({
    env: {
      PSHOME: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0',
      SystemRoot: 'C:\\Windows',
    },
  });

  assert.equal(
    resolvedPath,
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    'PowerShell runner must prefer the PSHOME executable when it exists.',
  );
}

{
  const plan = createTauriDevBinaryUnlockCheckPlan({
    rootDir: 'D:\\workspace\\sdkwork-birdcoder',
    env: {
      Path: `${path.dirname(process.execPath)};C:\\Windows\\System32`,
      PSHOME: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0',
      SystemRoot: 'C:\\Windows',
    },
    execPath: process.execPath,
  });

  assert.equal(
    plan.command,
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    'PowerShell unlock check must invoke an explicit PowerShell executable path on Windows.',
  );
  assert.deepEqual(
    plan.args,
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      'D:\\workspace\\sdkwork-birdcoder\\scripts\\ensure-tauri-dev-binary-unlocked.test.ps1',
    ],
    'PowerShell unlock check must target the governed unlock guard test script with stable arguments.',
  );
  assert.equal(plan.cwd, 'D:\\workspace\\sdkwork-birdcoder');
  assert.equal(plan.shell, false);
  assert.equal(plan.windowsHide, true);
  assert.equal(plan.env.NODE, process.execPath);
  assert.equal(plan.env.npm_node_execpath, process.execPath);
  assert.equal(
    String(plan.env.Path ?? '').split(';').includes(path.dirname(process.execPath)),
    true,
    'PowerShell unlock check must preserve the current Node.js directory on PATH.',
  );
}

{
  let invocationCount = 0;
  const exitCode = runTauriDevBinaryUnlockCheck({
    platform: 'linux',
    stdout() {
      invocationCount += 1;
    },
    spawnSyncImpl() {
      throw new Error('non-Windows hosts must not attempt to launch PowerShell');
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(invocationCount, 1);
}

{
  const invocations = [];
  const exitCode = runTauriDevBinaryUnlockCheck({
    rootDir: 'D:\\workspace\\sdkwork-birdcoder',
    platform: 'win32',
    env: {
      Path: `${path.dirname(process.execPath)};C:\\Windows\\System32`,
      PSHOME: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0',
      SystemRoot: 'C:\\Windows',
    },
    execPath: process.execPath,
    spawnSyncImpl(command, args, options) {
      invocations.push({ command, args, options });
      return { status: 0 };
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(invocations.length, 1);
  assert.equal(
    invocations[0].command,
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
  );
  assert.equal(invocations[0].options.cwd, 'D:\\workspace\\sdkwork-birdcoder');
  assert.equal(invocations[0].options.shell, false);
  assert.equal(invocations[0].options.stdio, 'inherit');
  assert.equal(invocations[0].options.windowsHide, true);
}

console.log('tauri dev binary unlock check runner contract passed.');
