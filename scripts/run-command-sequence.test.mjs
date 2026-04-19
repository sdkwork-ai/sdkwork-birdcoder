import assert from 'node:assert/strict';

import {
  createCommandSequencePlan,
  runCommandSequence,
} from './run-command-sequence.mjs';

function splitWindowsPathEntries(pathValue) {
  return String(pathValue ?? '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

{
  const plan = createCommandSequencePlan({
    command: 'node scripts/run-workspace-package-script.mjs . typecheck',
    cwd: 'D:/workspace',
    env: {
      ComSpec: 'C:/Windows/System32/cmd.exe',
      Path: 'C:/Windows/System32',
      BIRDCODER_ENV: 'governed',
    },
    platform: 'win32',
    execPath: 'C:/Program Files/nodejs/node.exe',
  });

  assert.equal(plan.command, 'C:/Windows/System32/cmd.exe');
  assert.deepEqual(plan.args, [
    '/d',
    '/s',
    '/c',
    'node scripts/run-workspace-package-script.mjs . typecheck',
  ]);
  assert.equal(plan.cwd, 'D:/workspace');
  assert.equal(plan.shell, false);
  assert.equal(plan.env.BIRDCODER_ENV, 'governed');
  assert.equal(plan.env.NODE, 'C:/Program Files/nodejs/node.exe');
  assert.equal(plan.env.npm_node_execpath, 'C:/Program Files/nodejs/node.exe');
  assert.deepEqual(
    splitWindowsPathEntries(plan.env.Path),
    ['C:/Program Files/nodejs', 'C:/Windows/System32'],
    'command-sequence plans must prepend the current Node.js binary directory so shell-launched node commands resolve reliably on Windows.',
  );
}

{
  const invocations = [];
  const exitCode = runCommandSequence({
    commands: ['node first-check.mjs', 'node failing-check.mjs', 'node skipped-check.mjs'],
    cwd: 'D:/workspace',
    env: {
      ComSpec: 'C:/Windows/System32/cmd.exe',
      Path: 'C:/Windows/System32',
      BIRDCODER_ENV: 'governed',
    },
    platform: 'win32',
    execPath: 'C:/Program Files/nodejs/node.exe',
    spawnSyncImpl(command, args, options) {
      invocations.push({ command, args, options });
      return {
        status: args.at(-1)?.includes('failing') ? 7 : 0,
      };
    },
  });

  assert.equal(exitCode, 7);
  assert.deepEqual(
    invocations.map((entry) => entry.args.at(-1)),
    ['node first-check.mjs', 'node failing-check.mjs'],
    'command-sequence runner must stop after the first failing command.',
  );
  assert.equal(invocations[0]?.command, 'C:/Windows/System32/cmd.exe');
  assert.deepEqual(invocations[0]?.args, ['/d', '/s', '/c', 'node first-check.mjs']);
  assert.equal(invocations[0]?.options.cwd, 'D:/workspace');
  assert.equal(invocations[0]?.options.shell, false);
  assert.equal(invocations[0]?.options.stdio, 'inherit');
  assert.equal(invocations[0]?.options.windowsHide, true);
  assert.equal(invocations[0]?.options.env.BIRDCODER_ENV, 'governed');
  assert.deepEqual(
    splitWindowsPathEntries(invocations[0]?.options.env.Path),
    ['C:/Program Files/nodejs', 'C:/Windows/System32'],
  );
}

console.log('run command sequence contract passed.');
