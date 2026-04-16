import assert from 'node:assert/strict';

import {
  RELEASE_FLOW_CHECK_COMMANDS,
  runReleaseFlowCheck,
} from './run-release-flow-check.mjs';

assert.equal(Array.isArray(RELEASE_FLOW_CHECK_COMMANDS), true);
assert.equal(RELEASE_FLOW_CHECK_COMMANDS.length > 0, true);
assert.equal(
  RELEASE_FLOW_CHECK_COMMANDS.includes('node scripts/release-flow-contract.test.mjs'),
  true,
  'release-flow runner must execute the release-flow contract before downstream lanes',
);
assert.equal(
  RELEASE_FLOW_CHECK_COMMANDS.includes('node scripts/package-script-entrypoints-contract.test.mjs'),
  true,
  'release-flow runner must execute the package script entrypoint contract before downstream lanes',
);
assert.equal(
  RELEASE_FLOW_CHECK_COMMANDS.includes('node scripts/governance-regression-report.test.mjs'),
  true,
  'release-flow runner must execute the governance regression runner contract before downstream lanes',
);
assert.equal(
  RELEASE_FLOW_CHECK_COMMANDS.includes('node scripts/quality-gate-execution-report.test.mjs'),
  true,
  'release-flow runner must execute the quality gate execution runner contract before downstream lanes',
);
assert.equal(
  RELEASE_FLOW_CHECK_COMMANDS.includes('node scripts/check-sdkwork-birdcoder-structure-contract.test.mjs'),
  true,
  'release-flow runner must execute the sdkwork-birdcoder structure contract before downstream lanes',
);
assert.equal(
  RELEASE_FLOW_CHECK_COMMANDS.includes('node scripts/release-openapi-canonical-quality-evidence-contract.test.mjs'),
  true,
  'release-flow runner must execute the canonical release quality evidence contract before downstream lanes',
);

{
  const invocations = [];
  const exitCode = runReleaseFlowCheck({
    commands: ['node first-check.mjs', 'node second-check.mjs'],
    cwd: 'D:/workspace',
    env: { TEST_ENV: 'birdcoder' },
    spawnSyncImpl(command, options) {
      invocations.push({ command, options });
      return { status: 0 };
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(
    invocations.map((entry) => entry.command),
    ['node first-check.mjs', 'node second-check.mjs'],
    'release-flow runner must execute commands in order',
  );
  for (const invocation of invocations) {
    assert.equal(invocation.options.cwd, 'D:/workspace');
    assert.deepEqual(invocation.options.env, { TEST_ENV: 'birdcoder' });
    assert.equal(invocation.options.shell, true);
    assert.equal(invocation.options.stdio, 'inherit');
    assert.equal(invocation.options.windowsHide, true);
  }
}

{
  const invocations = [];
  const exitCode = runReleaseFlowCheck({
    commands: ['node first-check.mjs', 'node failing-check.mjs', 'node skipped-check.mjs'],
    spawnSyncImpl(command) {
      invocations.push(command);
      return {
        status: command.includes('failing') ? 7 : 0,
      };
    },
  });

  assert.equal(exitCode, 7);
  assert.deepEqual(
    invocations,
    ['node first-check.mjs', 'node failing-check.mjs'],
    'release-flow runner must stop at the first failing command',
  );
}

console.log('release-flow runner contract passed.');
