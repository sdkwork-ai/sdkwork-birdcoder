import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';

import {
  RELEASE_FLOW_CHECK_COMMANDS,
  runReleaseFlowCheck,
} from './run-release-flow-check.mjs';

function splitPathEntries(pathValue, platform = process.platform) {
  return String(pathValue ?? '')
    .split(platform === 'win32' ? ';' : ':')
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
  RELEASE_FLOW_CHECK_COMMANDS.includes('node scripts/release/assert-release-readiness.test.mjs'),
  true,
  'release-flow runner must execute the finalized release readiness assertion contract before release-note lanes',
);
assert.equal(
  RELEASE_FLOW_CHECK_COMMANDS.includes('node scripts/release/write-attestation-evidence.test.mjs'),
  true,
  'release-flow runner must execute the attestation evidence contract before release readiness lanes',
);
assert.equal(
  RELEASE_FLOW_CHECK_COMMANDS.includes('node scripts/release/release-checksums.test.mjs'),
  true,
  'release-flow runner must execute the release checksum publication-view contract before release-note lanes',
);
assert.equal(
  RELEASE_FLOW_CHECK_COMMANDS.includes('node scripts/release/release-readiness-complete-matrix.test.mjs'),
  true,
  'release-flow runner must execute the complete release matrix readiness contract before finalized smoke lanes',
);
assert.equal(
  RELEASE_FLOW_CHECK_COMMANDS.includes('node scripts/release/write-readiness-fixture.mjs --help'),
  true,
  'release-flow runner must execute the readiness fixture CLI help path before finalized smoke lanes',
);
assert.equal(
  RELEASE_FLOW_CHECK_COMMANDS.includes('node scripts/release/write-readiness-fixture.test.mjs'),
  true,
  'release-flow runner must execute the complete release readiness fixture generator contract before finalized smoke lanes',
);
assert.equal(
  RELEASE_FLOW_CHECK_COMMANDS.includes('node scripts/release/candidate-dry-run.mjs --help'),
  true,
  'release-flow runner must execute the release candidate dry-run CLI help path before finalized smoke lanes',
);
assert.equal(
  RELEASE_FLOW_CHECK_COMMANDS.includes('node scripts/release/candidate-dry-run.test.mjs'),
  true,
  'release-flow runner must execute the release candidate dry-run evidence contract before finalized smoke lanes',
);
assert.equal(
  RELEASE_FLOW_CHECK_COMMANDS.includes('node --experimental-strip-types scripts/coding-server-openapi-snapshot-drift.test.ts'),
  true,
  'release-flow runner must execute the coding-server OpenAPI snapshot drift contract before downstream codegen lanes',
);

{
  const invocations = [];
  const commandEnv = { TEST_ENV: 'birdcoder' };
  const exitCode = runReleaseFlowCheck({
    commands: ['node first-check.mjs', 'node second-check.mjs'],
    cwd: 'D:/workspace',
    env: commandEnv,
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

    assert.equal(invocation.command, String(commandEnv.SHELL ?? '/bin/sh'));
    assert.deepEqual(invocation.args.slice(0, 1), ['-lc']);
  }
}

{
  const invocations = [];
  const exitCode = runReleaseFlowCheck({
    commands: ['node posix-check.mjs'],
    cwd: '/workspace',
    env: {
      PATH: '/usr/bin',
      SHELL: '/bin/bash',
      TEST_ENV: 'birdcoder',
    },
    execPath: '/opt/node/bin/node',
    platform: 'linux',
    spawnSyncImpl(command, args, options) {
      invocations.push({ command, args, options });
      return { status: 0 };
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(invocations.length, 1);
  assert.equal(
    invocations[0].command,
    '/bin/bash',
    'release-flow runner must honor the injected POSIX shell instead of reading the host process environment.',
  );
  assert.deepEqual(invocations[0].args, ['-lc', 'node posix-check.mjs']);
  assert.equal(invocations[0].options.cwd, '/workspace');
  assert.equal(invocations[0].options.env.TEST_ENV, 'birdcoder');
  assert.equal(invocations[0].options.env.NODE, '/opt/node/bin/node');
  assert.equal(invocations[0].options.env.npm_node_execpath, '/opt/node/bin/node');
  assert.deepEqual(
    splitPathEntries(invocations[0].options.env.PATH, 'linux'),
    ['/opt/node/bin', '/usr/bin'],
    'release-flow runner must prepend the injected Node.js directory to POSIX PATH.',
  );
  assert.equal(invocations[0].options.shell, false);
  assert.equal(invocations[0].options.stdio, 'inherit');
  assert.equal(invocations[0].options.windowsHide, true);
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
