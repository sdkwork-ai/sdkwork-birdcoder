import assert from 'node:assert/strict';

import { resolveDesktopRuntime } from '../packages/sdkwork-birdcoder-desktop/src/desktop/resolveDesktopRuntime.ts';
import { createHostStudioDescriptor } from '../packages/sdkwork-birdcoder-host-studio/src/index.ts';
import { resolveWebRuntime } from '../packages/sdkwork-birdcoder-web/src/web/resolveWebRuntime.ts';
import {
  BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME,
  BIRD_SERVER_DEFAULT_HOST,
  BIRD_SERVER_DEFAULT_PORT,
  resolveServerRuntime,
} from '../packages/sdkwork-birdcoder-server/src/index.ts';

const desktopGlobalRuntime = resolveDesktopRuntime();
assert.deepEqual(desktopGlobalRuntime, {
  mode: 'desktop',
  appId: 'sdkwork-birdcoder',
  appName: 'SDKWork BirdCoder',
  distributionId: 'global',
  apiBaseUrl: 'http://127.0.0.1:10240',
});

const desktopCnRuntime = resolveDesktopRuntime('cn');
assert.deepEqual(desktopCnRuntime, {
  mode: 'desktop',
  appId: 'sdkwork-birdcoder-cn',
  appName: 'SDKWork BirdCoder',
  distributionId: 'cn',
  apiBaseUrl: 'http://127.0.0.1:10240',
});

assert.deepEqual(resolveDesktopRuntime('global', { apiBaseUrl: 'https://deploy.example.com/birdcoder' }), {
  mode: 'desktop',
  appId: 'sdkwork-birdcoder',
  appName: 'SDKWork BirdCoder',
  distributionId: 'global',
  apiBaseUrl: 'https://deploy.example.com/birdcoder',
});

const webGlobalRuntime = resolveWebRuntime();
assert.deepEqual(webGlobalRuntime, {
  mode: 'web',
  appId: 'sdkwork-birdcoder',
  appName: 'SDKWork BirdCoder',
  distributionId: 'global',
  apiBaseUrl: 'http://127.0.0.1:10240',
});

const webCnRuntime = resolveWebRuntime('cn');
assert.deepEqual(webCnRuntime, {
  mode: 'web',
  appId: 'sdkwork-birdcoder-cn',
  appName: 'SDKWork BirdCoder',
  distributionId: 'cn',
  apiBaseUrl: 'http://127.0.0.1:10240',
});

assert.deepEqual(resolveWebRuntime('global', { apiBaseUrl: 'https://preview.example.com/birdcoder' }), {
  mode: 'web',
  appId: 'sdkwork-birdcoder',
  appName: 'SDKWork BirdCoder',
  distributionId: 'global',
  apiBaseUrl: 'https://preview.example.com/birdcoder',
});

const hostStudioGlobalRuntime = createHostStudioDescriptor();
assert.deepEqual(hostStudioGlobalRuntime, {
  mode: 'desktop',
  appId: 'sdkwork-birdcoder',
  appName: 'SDKWork BirdCoder',
  distributionId: 'global',
  apiBaseUrl: 'http://127.0.0.1:10240',
});

const hostStudioCnRuntime = createHostStudioDescriptor('cn');
assert.deepEqual(hostStudioCnRuntime, {
  mode: 'desktop',
  appId: 'sdkwork-birdcoder-cn',
  appName: 'SDKWork BirdCoder',
  distributionId: 'cn',
  apiBaseUrl: 'http://127.0.0.1:10240',
});

assert.deepEqual(
  createHostStudioDescriptor('global', { apiBaseUrl: 'https://studio.example.com/birdcoder' }),
  {
    mode: 'desktop',
    appId: 'sdkwork-birdcoder',
    appName: 'SDKWork BirdCoder',
    distributionId: 'global',
    apiBaseUrl: 'https://studio.example.com/birdcoder',
  },
);

const serverGlobalRuntime = resolveServerRuntime();
assert.deepEqual(serverGlobalRuntime, {
  mode: 'server',
  appId: 'sdkwork-birdcoder',
  appName: 'SDKWork BirdCoder',
  distributionId: 'global',
  apiBaseUrl: 'http://127.0.0.1:10240',
  host: BIRD_SERVER_DEFAULT_HOST,
  port: BIRD_SERVER_DEFAULT_PORT,
  configFileName: BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME,
});

const serverCnRuntime = resolveServerRuntime('cn');
assert.deepEqual(serverCnRuntime, {
  mode: 'server',
  appId: 'sdkwork-birdcoder-cn',
  appName: 'SDKWork BirdCoder',
  distributionId: 'cn',
  apiBaseUrl: 'http://127.0.0.1:10240',
  host: BIRD_SERVER_DEFAULT_HOST,
  port: BIRD_SERVER_DEFAULT_PORT,
  configFileName: BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME,
});

assert.deepEqual(resolveServerRuntime('global', { apiBaseUrl: 'https://server.example.com/birdcoder' }), {
  mode: 'server',
  appId: 'sdkwork-birdcoder',
  appName: 'SDKWork BirdCoder',
  distributionId: 'global',
  apiBaseUrl: 'https://server.example.com/birdcoder',
  host: BIRD_SERVER_DEFAULT_HOST,
  port: BIRD_SERVER_DEFAULT_PORT,
  configFileName: BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME,
});

console.log('host runtime contract passed.');
