import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const hostStudioModulePath = new URL(
  '../packages/sdkwork-birdcoder-host-studio/src/index.ts',
  import.meta.url,
);

assert.equal(
  existsSync(hostStudioModulePath),
  true,
  'Host studio entry must exist.',
);

const {
  HOST_STUDIO_SIMULATOR_ADAPTER_ID,
  resolveHostStudioSimulatorSession,
} = await import('../packages/sdkwork-birdcoder-host-studio/src/index.ts');

const defaultWebSimulator = resolveHostStudioSimulatorSession({
  platform: 'web',
});

assert.deepEqual(defaultWebSimulator, {
  adapterId: HOST_STUDIO_SIMULATOR_ADAPTER_ID,
  host: {
    mode: 'desktop',
    appId: 'sdkwork-birdcoder',
    appName: 'SDKWork BirdCoder',
    distributionId: 'global',
    apiBaseUrl: 'https://api.sdkwork.com/birdcoder',
  },
  target: {
    platform: 'web',
    channel: 'web.desktop',
    runtime: 'browser',
    orientation: 'portrait',
    webDevice: 'desktop',
    miniProgramPlatform: null,
    appPlatform: null,
    deviceModel: null,
  },
  evidenceKey: 'simulator.global.web.desktop.browser.portrait',
});

const cnHarmonySimulator = resolveHostStudioSimulatorSession(
  {
    platform: 'app',
    appPlatform: 'harmony',
    deviceModel: 'mate-60',
    isLandscape: true,
  },
  'cn',
);

assert.deepEqual(cnHarmonySimulator, {
  adapterId: HOST_STUDIO_SIMULATOR_ADAPTER_ID,
  host: {
    mode: 'desktop',
    appId: 'sdkwork-birdcoder-cn',
    appName: 'SDKWork BirdCoder',
    distributionId: 'cn',
    apiBaseUrl: 'https://cn.sdkwork.local/birdcoder/api',
  },
  target: {
    platform: 'app',
    channel: 'app.harmony',
    runtime: 'harmony-emulator',
    orientation: 'landscape',
    webDevice: null,
    miniProgramPlatform: null,
    appPlatform: 'harmony',
    deviceModel: 'mate-60',
  },
  evidenceKey: 'simulator.cn.app.harmony.harmony-emulator.landscape',
});

console.log('host studio simulator contract passed.');
