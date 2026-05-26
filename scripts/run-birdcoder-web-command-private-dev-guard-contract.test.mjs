import assert from 'node:assert/strict';

const { runBirdcoderWebCommand } = await import('./run-birdcoder-web-command.mjs');

assert.throws(
  () =>
    runBirdcoderWebCommand({
      argv: ['dev:test', '--iam-mode', 'server-private'],
      spawnSyncImpl: () => {
        throw new Error('private web dev must fail before spawning the client-only Vite host');
      },
    }),
  /Use run-birdcoder-dev-stack\.mjs web --iam-mode server-private/u,
  'server-private web dev:test must not launch the client-only web command because appbase-backed pages require :10240 server readiness.',
);

console.log('run-birdcoder-web-command private dev guard contract passed.');
