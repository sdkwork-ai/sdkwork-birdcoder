import assert from 'node:assert/strict';

import {
  createPatchedExec,
  isWindowsNetUseCommand,
} from './vite-windows-realpath-patch.mjs';

assert.equal(isWindowsNetUseCommand('net use'), true);
assert.equal(isWindowsNetUseCommand('NET USE'), true);
assert.equal(isWindowsNetUseCommand('net    use   '), true);
assert.equal(isWindowsNetUseCommand('pnpm build'), false);

let delegatedCommand = null;
const delegatedExec = createPatchedExec((command, ...args) => {
  delegatedCommand = { command, args };
  return {
    kill() {
      return true;
    },
  };
});

const delegatedResult = delegatedExec('pnpm build', { cwd: process.cwd() }, () => {});
assert.equal(delegatedCommand?.command, 'pnpm build');
assert.equal(typeof delegatedResult.kill, 'function');

const thrownError = Object.assign(new Error('spawn EPERM'), {
  code: 'EPERM',
  errno: -4048,
  syscall: 'spawn',
});
const callbackCalls = [];
const patchedExec = createPatchedExec(() => {
  throw thrownError;
});
const fallbackChild = patchedExec('net use', (error, stdout, stderr) => {
  callbackCalls.push({ error, stdout, stderr });
});

assert.equal(typeof fallbackChild.kill, 'function');
assert.equal(typeof fallbackChild.on, 'function');
assert.equal(typeof fallbackChild.once, 'function');
assert.equal(callbackCalls.length, 0);

await new Promise((resolve) => setImmediate(resolve));

assert.equal(callbackCalls.length, 1);
assert.equal(callbackCalls[0]?.error, thrownError);
assert.equal(callbackCalls[0]?.stdout, '');
assert.equal(callbackCalls[0]?.stderr, '');

assert.throws(
  () =>
    patchedExec('net use', {
      cwd: process.cwd(),
    }),
  /spawn EPERM/,
  'The patch should only suppress net use failures when Vite supplied a callback.',
);

console.log('vite windows realpath patch contract passed.');
