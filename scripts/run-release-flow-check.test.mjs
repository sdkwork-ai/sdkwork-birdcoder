import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  RELEASE_FLOW_CHECK_COMMANDS,
  RELEASE_FLOW_CHECK_LANES,
  runReleaseFlowCheck,
} from './run-release-flow-check.mjs';

function splitPathEntries(pathValue, platform = process.platform) {
  return String(pathValue ?? '')
    .split(platform === 'win32' ? ';' : ':')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

assert.deepEqual(
  RELEASE_FLOW_CHECK_COMMANDS,
  Object.values(RELEASE_FLOW_CHECK_LANES).flat(),
  'release-flow commands must be derived from the named release lanes.',
);
assert.equal(new Set(RELEASE_FLOW_CHECK_COMMANDS).size, RELEASE_FLOW_CHECK_COMMANDS.length);

for (const [laneName, commands] of Object.entries(RELEASE_FLOW_CHECK_LANES)) {
  assert.equal(commands.length > 0, true, `Release-flow lane ${laneName} must not be empty.`);
}

const requiredCommands = [
  'node scripts/release-flow-contract.test.mjs',
  'node scripts/domain-ownership-contract.test.mjs',
  'node scripts/persistence-ownership-contract.test.mjs',
  'node scripts/birdcoder-sdk-owner-boundary-contract.test.mjs',
  'node scripts/agents-birdcoder-alignment-contract.test.mjs',
  'node --experimental-strip-types scripts/skills-sdk-boundary-contract.test.ts',
  'node --experimental-strip-types scripts/document-app-consumer-contract.test.ts',
  'node scripts/release/package-release-assets.test.mjs',
  'node scripts/release/write-package-sbom-evidence.test.mjs',
  'node scripts/release/write-attestation-evidence.test.mjs',
  'node scripts/release/release-checksums.test.mjs',
  'node scripts/release/assert-release-readiness.test.mjs',
  'node scripts/check-release-closure.mjs',
  'node scripts/technical-debt-contract.test.mjs',
  'node scripts/sdkwork-birdcoder-architecture-contract.test.mjs',
];
for (const command of requiredCommands) {
  assert.equal(
    RELEASE_FLOW_CHECK_COMMANDS.includes(command),
    true,
    `Release flow must include ${command}.`,
  );
}

const retiredAuthorityPattern = /coding-server|coding-session-projection|template-instantiation|prompt-skill-template|kernel-bridge|provider-sdk|run-claw-server|birdcoder-agents-integration/iu;
for (const command of RELEASE_FLOW_CHECK_COMMANDS) {
  assert.doesNotMatch(command, retiredAuthorityPattern);

  const localScriptPaths = command.match(/scripts\/[A-Za-z0-9_./-]+\.(?:mjs|js|ts)/gu) ?? [];
  for (const relativePath of localScriptPaths) {
    assert.equal(
      fs.existsSync(path.join(process.cwd(), ...relativePath.split('/'))),
      true,
      `Release-flow command references a missing script: ${relativePath}`,
    );
  }
}

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
    );
    assert.equal(invocation.options.shell, false);
    assert.equal(invocation.options.stdio, 'inherit');
    assert.equal(invocation.options.windowsHide, true);
    if (process.platform === 'win32') {
      assert.equal(invocation.command, 'cmd.exe');
      assert.deepEqual(invocation.args.slice(0, 3), ['/d', '/s', '/c']);
    } else {
      assert.equal(invocation.command, String(commandEnv.SHELL ?? '/bin/sh'));
      assert.deepEqual(invocation.args.slice(0, 1), ['-lc']);
    }
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
  assert.equal(invocations[0].command, '/bin/bash');
  assert.deepEqual(invocations[0].args, ['-lc', 'node posix-check.mjs']);
  assert.deepEqual(
    splitPathEntries(invocations[0].options.env.PATH, 'linux'),
    ['/opt/node/bin', '/usr/bin'],
  );
}

{
  const invocations = [];
  const exitCode = runReleaseFlowCheck({
    commands: ['node first-check.mjs', 'node failing-check.mjs', 'node skipped-check.mjs'],
    spawnSyncImpl(command, args) {
      invocations.push({ command, args });
      return { status: args.at(-1)?.includes('failing') ? 7 : 0 };
    },
  });

  assert.equal(exitCode, 7);
  assert.deepEqual(
    invocations.map((entry) => entry.args.at(-1)),
    ['node first-check.mjs', 'node failing-check.mjs'],
  );
}

console.log('release-flow runner contract passed.');
