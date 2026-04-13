import assert from 'node:assert/strict';

import { prepareSharedSdkPackages } from './prepare-shared-sdk-packages.mjs';

const sourceLogs = [];
const sourceResult = prepareSharedSdkPackages({
  env: {},
  logger: {
    log(message) {
      sourceLogs.push(String(message));
    },
  },
});
assert.equal(sourceResult.mode, 'source');
assert.equal(sourceResult.prepared, false);
assert.ok(
  sourceLogs.some((message) => message.includes('shared SDK mode is source')),
  'source mode must log the resolved shared SDK mode',
);

const gitLogs = [];
const gitResult = prepareSharedSdkPackages({
  env: {
    SDKWORK_SHARED_SDK_MODE: 'git',
  },
  logger: {
    log(message) {
      gitLogs.push(String(message));
    },
  },
});
assert.equal(gitResult.mode, 'git');
assert.equal(gitResult.prepared, false);
assert.ok(
  gitLogs.some((message) => message.includes('workspace-local SDK packages')),
  'git mode must still log the BirdCoder workspace-local SDK stance',
);
assert.ok(
  gitLogs.some((message) => message.includes('shared SDK mode is git')),
  'git mode must log the resolved shared SDK mode',
);

console.log('prepare shared sdk packages contract passed.');
