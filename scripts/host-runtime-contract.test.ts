import assert from 'node:assert/strict';
import fs from 'node:fs';

import { resolveDesktopRuntime } from '../packages/sdkwork-birdcoder-desktop/src/desktop/resolveDesktopRuntime.ts';
import { createHostStudioDescriptor } from '../packages/sdkwork-birdcoder-host-studio/src/index.ts';
import { resolveWebRuntime } from '../packages/sdkwork-birdcoder-web/src/web/resolveWebRuntime.ts';
import {
  BIRDCODER_DEFAULT_LOCAL_API_HOST,
  BIRDCODER_DEFAULT_LOCAL_API_PORT,
  createBirdHostDescriptorFromDistribution,
} from '../packages/sdkwork-birdcoder-host-core/src/index.ts';

const BIRD_SERVER_DEFAULT_HOST = BIRDCODER_DEFAULT_LOCAL_API_HOST;
const BIRD_SERVER_DEFAULT_PORT = BIRDCODER_DEFAULT_LOCAL_API_PORT;
const BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME = 'bird-server.config.json';
const serverIndexSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-server/src/index.ts', import.meta.url),
  'utf8',
);

assert.match(
  serverIndexSource,
  /export const BIRD_SERVER_DEFAULT_HOST = BIRDCODER_DEFAULT_LOCAL_API_HOST;/u,
  'coding-server entry must expose the canonical default server host constant.',
);
assert.match(
  serverIndexSource,
  /export const BIRD_SERVER_DEFAULT_PORT = BIRDCODER_DEFAULT_LOCAL_API_PORT;/u,
  'coding-server entry must expose the canonical default server port constant.',
);
assert.match(
  serverIndexSource,
  /export const BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME = 'bird-server\.config\.json';/u,
  'coding-server entry must expose the canonical default server config filename.',
);
assert.match(
  serverIndexSource,
  /export function resolveServerRuntime\(/u,
  'coding-server entry must expose the canonical server runtime descriptor resolver.',
);

function resolveServerRuntime(
  distributionId: 'cn' | 'global' = 'global',
  overrides: Partial<{
    apiBaseUrl: string;
    appId: string;
    appName: string;
    configFileName: string;
    distributionId: string;
    host: string;
    mode: 'server';
    port: number;
  }> = {},
) {
  const distribution =
    distributionId === 'cn'
      ? {
          id: 'cn',
          appId: 'sdkwork-birdcoder-cn',
          appName: 'SDKWork BirdCoder',
          apiBaseUrl: 'http://127.0.0.1:10240',
        }
      : {
          id: 'global',
          appId: 'sdkwork-birdcoder',
          appName: 'SDKWork BirdCoder',
          apiBaseUrl: 'http://127.0.0.1:10240',
        };
  const hostDescriptor = createBirdHostDescriptorFromDistribution('server', distribution, {
    ...(overrides.apiBaseUrl ? { apiBaseUrl: overrides.apiBaseUrl } : {}),
    ...(overrides.appId ? { appId: overrides.appId } : {}),
    ...(overrides.appName ? { appName: overrides.appName } : {}),
    ...(overrides.distributionId ? { distributionId: overrides.distributionId } : {}),
    ...(overrides.mode ? { mode: overrides.mode } : {}),
  });

  return {
    ...hostDescriptor,
    host: overrides.host ?? BIRD_SERVER_DEFAULT_HOST,
    port: overrides.port ?? BIRD_SERVER_DEFAULT_PORT,
    configFileName: overrides.configFileName ?? BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME,
  };
}

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
