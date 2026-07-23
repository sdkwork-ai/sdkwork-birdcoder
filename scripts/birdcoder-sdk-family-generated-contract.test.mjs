import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: 'pipe',
    ...options,
  });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(' ')} failed:\n${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  );
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

const syncOutput = run(process.execPath, ['scripts/sync-birdcoder-sdk-openapi.mjs', '--check']);
assert.match(syncOutput, /4 operations/u);

const dryRunOutput = run(process.execPath, [
  'scripts/generate-birdcoder-sdkgen-family.mjs',
  '--dry-run',
]);
assert.match(dryRunOutput, /typescript/iu);
assert.match(dryRunOutput, /rust/iu);
assert.doesNotMatch(dryRunOutput, /backend/iu);

run(process.execPath, [
  'scripts/run-local-typescript.mjs',
  '--cwd',
  'sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript/generated/server-openapi',
  '--noEmit',
]);

run(
  'cargo',
  [
    'check',
    '--manifest-path',
    path.join(
      rootDir,
      'sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-rust/generated/server-openapi/Cargo.toml',
    ),
  ],
  {
    env: {
      ...process.env,
      CARGO_TARGET_DIR: path.join(os.tmpdir(), 'birdcoder-app-sdk-generated-contract-target'),
    },
  },
);

console.log('BirdCoder App SDK generated contract passed.');
