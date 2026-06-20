import assert from 'node:assert/strict';

const { runBirdcoderDevStack } = await import('./run-birdcoder-dev-stack.mjs');

const originalLog = console.log;
const originalError = console.error;

async function captureRunBirdcoderDevStack(argv) {
  const logs = [];
  const errors = [];

  console.log = (...args) => {
    logs.push(args.join(' '));
  };
  console.error = (...args) => {
    errors.push(args.join(' '));
  };

  try {
    const exitCode = await runBirdcoderDevStack({ argv });
    return {
      exitCode,
      stderr: errors.join('\n'),
      stdout: logs.join('\n'),
    };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

const defaultDryRun = await captureRunBirdcoderDevStack([
  'web',
  '--iam-mode',
  'server-private',
  '--',
  '--host',
  '127.0.0.1',
  '--port',
  '4173',
  '--dry-run',
]);

{
  const { exitCode, stderr, stdout } = defaultDryRun;
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
    /\[birdcoder-stack\] iamMode=server-private/u,
    'dry-run should keep the private IAM mode when launched through the default web stack.',
  );
  assert.match(
    stdout,
    /\[birdcoder-stack\] client=.*--host 127\.0\.0\.1 --port 4173/u,
    'passthrough browser-host arguments should stay attached to the client plan when pnpm forwards them after "--".',
  );
  assert.match(
    stdout,
    /\[birdcoder-stack\] devPrefillAccount=/u,
    'dry-run should expose whether optional dev auth prefill is configured.',
  );
  assert.match(
    stdout,
    /\[birdcoder-stack\] devPrefillPassword=\*\*\*/u,
    'dry-run should mask optional dev auth prefill passwords.',
  );
  assert.match(
    stdout,
    /\[birdcoder-stack\] dry-run complete/u,
    'dry-run should terminate cleanly after printing the standardized stack summary.',
  );
}

const testModeDryRun = await captureRunBirdcoderDevStack([
  'web',
  '--iam-mode',
  'server-private',
  '--vite-mode',
  'test',
  '--dry-run',
]);

{
  const {
    exitCode,
    stderr: testModeStderr,
    stdout: testModeStdout,
  } = testModeDryRun;
  assert.equal(
    exitCode,
    0,
    `web test-mode stack dry-run should succeed.\nstdout:\n${testModeStdout}\nstderr:\n${testModeStderr}`,
  );
  assert.equal(
    testModeStderr,
    '',
    `web test-mode stack dry-run should not emit errors.\nstderr:\n${testModeStderr}`,
  );
  assert.match(
    testModeStdout,
    /\[birdcoder-stack\] server=/u,
    'web test-mode stack must still start the server before the appbase-backed web host.',
  );
  assert.match(
    testModeStdout,
    /\[birdcoder-stack\] client=.*run-vite-host\.mjs serve .*--mode test/u,
    'web test-mode stack must use the test-mode Vite host instead of the development client mode.',
  );
}

console.log('birdcoder dev stack contract passed.');
