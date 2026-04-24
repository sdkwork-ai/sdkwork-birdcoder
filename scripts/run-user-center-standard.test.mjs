import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..');

async function loadModule() {
  return import(
    pathToFileURL(
      path.join(rootDir, 'scripts', 'run-user-center-standard.mjs'),
    ).href,
  );
}

test('birdcoder user-center standard runner exposes the canonical governed node plan', async () => {
  const module = await loadModule();

  assert.equal(typeof module.resolveUserCenterStandardTestFile, 'function');
  assert.equal(typeof module.createUserCenterStandardTestPlan, 'function');

  const testFile = module.resolveUserCenterStandardTestFile({
    rootDir: 'D:/workspace/sdkwork-birdcoder',
  });
  assert.equal(
    testFile,
    path.join('D:/workspace/sdkwork-birdcoder', 'scripts', 'user-center-standard.test.mjs'),
  );

  const plan = module.createUserCenterStandardTestPlan({
    rootDir: 'D:/workspace/sdkwork-birdcoder',
    cwd: 'D:/workspace/sdkwork-birdcoder',
    env: { SDKWORK_RELEASE_MODE: '1' },
    nodeExecutable: 'node-custom',
  });

  assert.equal(plan.command, 'node-custom');
  assert.deepEqual(plan.args, [testFile]);
  assert.equal(plan.cwd, 'D:/workspace/sdkwork-birdcoder');
  assert.deepEqual(plan.env, { SDKWORK_RELEASE_MODE: '1' });
  assert.equal(plan.shell, false);
  assert.equal(plan.windowsHide, process.platform === 'win32');
});

test('birdcoder user-center standard runner executes the canonical node command through spawnSync', async () => {
  const module = await loadModule();

  const calls = [];
  const result = module.runUserCenterStandardTest({
    rootDir: 'D:/workspace/sdkwork-birdcoder',
    cwd: 'D:/workspace/sdkwork-birdcoder',
    env: { SDKWORK_ENV: '1' },
    nodeExecutable: 'node-custom',
    spawnSyncImpl(command, args, options) {
      calls.push({ command, args, options });
      return {
        status: 0,
        stdout: '',
        stderr: '',
      };
    },
  });

  assert.equal(result.status, 0);
  assert.deepEqual(calls, [
    {
      command: 'node-custom',
      args: [
        path.join('D:/workspace/sdkwork-birdcoder', 'scripts', 'user-center-standard.test.mjs'),
      ],
      options: {
        cwd: 'D:/workspace/sdkwork-birdcoder',
        env: { SDKWORK_ENV: '1' },
        shell: false,
        stdio: 'inherit',
        windowsHide: process.platform === 'win32',
      },
    },
  ]);
});
