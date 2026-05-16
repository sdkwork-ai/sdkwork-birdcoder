import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    shell: false,
    stdio: 'pipe',
    ...options,
  });

  assert.equal(
    result.status,
    0,
    [
      `Command failed: ${command} ${args.join(' ')}`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n'),
  );

  return result;
}

run(process.execPath, ['scripts/sync-birdcoder-sdk-openapi.mjs', '--check']);
run(process.execPath, ['scripts/generate-birdcoder-sdk-family.mjs', '--check']);

for (const relativeDir of [
  'sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript',
  'sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-typescript',
]) {
  run(process.execPath, [
    'scripts/run-local-typescript.mjs',
    '--cwd',
    relativeDir,
    '--noEmit',
  ]);
}

for (const relativeManifestPath of [
  'sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-rust/Cargo.toml',
  'sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-rust/Cargo.toml',
]) {
  const crateName = path.basename(path.dirname(relativeManifestPath));
  run('cargo', [
    'check',
    '--manifest-path',
    path.join(rootDir, relativeManifestPath),
  ], {
    env: {
      ...process.env,
      CARGO_TARGET_DIR: path.join(os.tmpdir(), 'birdcoder-sdk-family-cargo-target', crateName),
    },
  });
}

console.log('birdcoder SDK family generated contract passed.');
