import assert from 'node:assert/strict';

import {
  isSharedSdkSourceMode,
  resolveSharedSdkMode,
  SHARED_SDK_MODE_ENV_VAR,
  SHARED_SDK_MODE_GIT,
  SHARED_SDK_MODE_SOURCE,
} from './shared-sdk-mode.mjs';

assert.equal(SHARED_SDK_MODE_ENV_VAR, 'SDKWORK_SHARED_SDK_MODE');
assert.equal(SHARED_SDK_MODE_SOURCE, 'source');
assert.equal(SHARED_SDK_MODE_GIT, 'git');

assert.equal(resolveSharedSdkMode({}), SHARED_SDK_MODE_SOURCE);
assert.equal(resolveSharedSdkMode({ [SHARED_SDK_MODE_ENV_VAR]: 'git' }), SHARED_SDK_MODE_GIT);
assert.equal(resolveSharedSdkMode({ [SHARED_SDK_MODE_ENV_VAR]: ' Git ' }), SHARED_SDK_MODE_GIT);
assert.equal(resolveSharedSdkMode({ [SHARED_SDK_MODE_ENV_VAR]: 'unexpected' }), SHARED_SDK_MODE_SOURCE);

assert.equal(isSharedSdkSourceMode({}), true);
assert.equal(isSharedSdkSourceMode({ [SHARED_SDK_MODE_ENV_VAR]: 'git' }), false);

console.log('shared sdk mode contract passed.');
