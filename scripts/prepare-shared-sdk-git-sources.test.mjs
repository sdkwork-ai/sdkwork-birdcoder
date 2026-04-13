import assert from 'node:assert/strict';

import { ensureSharedSdkGitSources } from './prepare-shared-sdk-git-sources.mjs';

const sourceLogs = [];
const sourceResult = ensureSharedSdkGitSources({
  env: {},
  logger: {
    log(message) {
      sourceLogs.push(String(message));
    },
  },
});

assert.equal(sourceResult.mode, 'source');
assert.equal(sourceResult.changed, false);
assert.equal(sourceResult.status, 'skipped');
assert.ok(
  sourceLogs.some((message) => message.includes('shared SDK mode is source')),
  'source mode must log source-mode skipping',
);

const gitLogs = [];
const gitResult = ensureSharedSdkGitSources({
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
assert.equal(gitResult.changed, false);
assert.equal(gitResult.status, 'ready');
assert.ok(
  gitLogs.some((message) => message.includes('workspace-local SDK packages')),
  'git mode must document workspace-local SDK behavior',
);

console.log('prepare shared sdk git sources contract passed.');
