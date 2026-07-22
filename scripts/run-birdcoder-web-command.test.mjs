import assert from 'node:assert/strict';

import { runBirdcoderWebCommand } from './run-birdcoder-web-command.mjs';

const expectedScripts = new Map([
  ['build', 'release:build:browser'],
  ['build:dev', 'build:dev'],
  ['build:prod', 'build:prod'],
  ['build:test', 'build:test'],
]);

for (const [action, expectedScript] of expectedScripts) {
  let spawnedLifecycleEvent;
  const status = runBirdcoderWebCommand({
    argv: [action, '--iam-mode', 'server-private'],
    spawnSyncImpl: (_command, _args, options) => {
      spawnedLifecycleEvent = options.env.npm_lifecycle_event;
      return { status: 0 };
    },
  });

  assert.equal(status, 0);
  assert.equal(
    spawnedLifecycleEvent,
    expectedScript,
    `${action} must delegate to the existing ${expectedScript} Web package script.`,
  );
}

console.log('run-birdcoder-web-command contract passed.');
