import assert from 'node:assert/strict';

import {
  configureDefaultBirdCoderIdeServicesRuntime,
  resetDefaultBirdCoderIdeServicesRuntimeForTests,
} from '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServicesRuntime.ts';
import {
  createBirdCoderRuntimeUserCenterClient,
  resolveBirdCoderRuntimeUserCenterApiBaseUrl,
} from '../packages/sdkwork-birdcoder-infrastructure/src/services/userCenterRuntimeBridge.ts';

resetDefaultBirdCoderIdeServicesRuntimeForTests();

configureDefaultBirdCoderIdeServicesRuntime({
  userCenter: {
    providerKind: 'builtin-local',
  },
});

assert.notEqual(
  createBirdCoderRuntimeUserCenterClient(),
  null,
  'builtin-local user-center mode must still expose the canonical appbase runtime client so BirdCoder does not keep duplicate local profile/VIP storage fallbacks.',
);

resetDefaultBirdCoderIdeServicesRuntimeForTests();

configureDefaultBirdCoderIdeServicesRuntime({
  apiBaseUrl: 'http://127.0.0.1:10240',
  userCenter: {
    providerKind: 'builtin-local',
  },
});

assert.equal(
  resolveBirdCoderRuntimeUserCenterApiBaseUrl(),
  'http://127.0.0.1:10240',
  'runtime user-center bridge must bind to the authoritative app API base URL instead of the current page origin when a remote server API is configured.',
);

resetDefaultBirdCoderIdeServicesRuntimeForTests();

console.log('birdcoder user center runtime bridge contract passed.');
