import assert from 'node:assert/strict';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const { runBirdcoderDevStack } = await import('./run-birdcoder-dev-stack.mjs');

const originalLog = console.log;
const originalError = console.error;
const logs = [];
const errors = [];

console.log = (...args) => {
  logs.push(args.join(' '));
};
console.error = (...args) => {
  errors.push(args.join(' '));
};

let exitCode;
try {
  exitCode = await runBirdcoderDevStack({
    argv: [
      'web',
      '--identity-mode',
      'server-private',
      '--',
      '--host',
      '127.0.0.1',
      '--port',
      '4173',
      '--dry-run',
    ],
  });
} finally {
  console.log = originalLog;
  console.error = originalError;
}

const stdout = logs.join('\n');
const stderr = errors.join('\n');

assert.equal(
  exitCode,
  0,
  `run-birdcoder-dev-stack should accept package-manager passthrough separators in dry-run mode.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
);
assert.equal(
  stderr,
  '',
  `dry-run should not emit error output.\nstderr:\n${stderr}`,
);
assert.match(
  stdout,
  /\[birdcoder-stack\] surface=web/u,
  'dry-run should still print the resolved web stack summary.',
);
assert.match(
  stdout,
  /\[birdcoder-stack\] identityMode=server-private/u,
  'dry-run should keep the private identity mode when launched through the default web stack.',
);
assert.match(
  stdout,
  /\[birdcoder-stack\] client=.*--host 127\.0\.0\.1 --port 4173/u,
  'passthrough browser-host arguments should stay attached to the client plan when pnpm forwards them after "--".',
);
assert.match(
  stdout,
  /\[birdcoder-stack\] sampleAccount=local-default@sdkwork-birdcoder\.local/u,
  'dry-run should expose the builtin-local bootstrap account for quick-login verification.',
);
assert.match(
  stdout,
  /\[birdcoder-stack\] samplePassword=dev123456/u,
  'dry-run should expose the builtin-local bootstrap password for quick-login verification.',
);
assert.match(
  stdout,
  /\[birdcoder-stack\] dry-run complete/u,
  'dry-run should terminate cleanly after printing the standardized stack summary.',
);

console.log('birdcoder dev stack contract passed.');
