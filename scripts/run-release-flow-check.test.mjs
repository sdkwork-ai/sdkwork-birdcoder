import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';

import {
  RELEASE_FLOW_CHECK_COMMANDS,
  runReleaseFlowCheck,
} from './run-release-flow-check.mjs';

function splitPathEntries(pathValue) {
  return String(pathValue ?? '')
    .split(process.platform === 'win32' ? ';' : ':')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

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
assert.equal(
  RELEASE_FLOW_CHECK_COMMANDS.includes('node --experimental-strip-types scripts/coding-server-openapi-snapshot-drift.test.ts'),
  true,
  'release-flow runner must execute the coding-server OpenAPI snapshot drift contract before downstream codegen lanes',
);

{
  const invocations = [];
  const exitCode = runReleaseFlowCheck({
    commands: ['node first-check.mjs', 'node second-check.mjs'],
    cwd: 'D:/workspace',
    env: { TEST_ENV: 'birdcoder' },
    spawnSyncImpl(command, args, options) {
      invocations.push({ command, args, options });
      return { status: 0 };
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(
    invocations.map((entry) => entry.args.at(-1)),
    ['node first-check.mjs', 'node second-check.mjs'],
    'release-flow runner must execute commands in order',
  );
  for (const invocation of invocations) {
    assert.equal(invocation.options.cwd, 'D:/workspace');
    assert.equal(invocation.options.env.TEST_ENV, 'birdcoder');
    assert.equal(invocation.options.env.NODE, process.execPath);
    assert.equal(invocation.options.env.npm_node_execpath, process.execPath);
    assert.equal(
      splitPathEntries(
        invocation.options.env.Path ?? invocation.options.env.PATH ?? '',
      ).includes(path.dirname(process.execPath)),
      true,
      'release-flow runner must prepend the current Node.js directory to PATH.',
    );
    assert.equal(invocation.options.shell, false);
    assert.equal(invocation.options.stdio, 'inherit');
    assert.equal(invocation.options.windowsHide, true);
    if (process.platform === 'win32') {
      assert.equal(invocation.command, 'cmd.exe');
      assert.deepEqual(invocation.args.slice(0, 3), ['/d', '/s', '/c']);
      continue;
    }

    assert.equal(invocation.command, String(process.env.SHELL ?? '/bin/sh'));
    assert.deepEqual(invocation.args.slice(0, 1), ['-lc']);
  }
}

{
  const invocations = [];
  const exitCode = runReleaseFlowCheck({
    commands: ['node first-check.mjs', 'node failing-check.mjs', 'node skipped-check.mjs'],
    spawnSyncImpl(command, args) {
      invocations.push({ command, args });
      return {
        status: args.at(-1)?.includes('failing') ? 7 : 0,
      };
    },
  });

  assert.equal(exitCode, 7);
  assert.deepEqual(
    invocations.map((entry) => entry.args.at(-1)),
    ['node first-check.mjs', 'node failing-check.mjs'],
    'release-flow runner must stop at the first failing command',
  );
}

console.log('release-flow runner contract passed.');
