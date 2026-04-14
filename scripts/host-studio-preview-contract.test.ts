import assert from 'node:assert/strict';

import {
  HOST_STUDIO_PREVIEW_ADAPTER_ID,
  resolveHostStudioPreviewSession,
} from '../packages/sdkwork-birdcoder-host-studio/src/index.ts';

const defaultWebPreview = resolveHostStudioPreviewSession({
  url: 'http://127.0.0.1:4173',
});

assert.deepEqual(defaultWebPreview, {
  adapterId: HOST_STUDIO_PREVIEW_ADAPTER_ID,
  host: {
    mode: 'desktop',
    appId: 'sdkwork-birdcoder',
    appName: 'SDKWork BirdCoder',
    distributionId: 'global',
    apiBaseUrl: 'https://api.sdkwork.com/birdcoder',
  },
  target: {
    url: 'http://127.0.0.1:4173',
    platform: 'web',
    channel: 'web.desktop',
    orientation: 'portrait',
    webDevice: 'desktop',
    miniProgramPlatform: null,
    appPlatform: null,
    deviceModel: null,
  },
  evidenceKey: 'preview.global.web.desktop.portrait',
});

const cnHarmonyPreview = resolveHostStudioPreviewSession(
  {
    url: 'http://127.0.0.1:4173/app',
    platform: 'app',
    appPlatform: 'harmony',
    deviceModel: 'mate-60',
    isLandscape: true,
  },
  'cn',
);

assert.deepEqual(cnHarmonyPreview, {
  adapterId: HOST_STUDIO_PREVIEW_ADAPTER_ID,
  host: {
    mode: 'desktop',
    appId: 'sdkwork-birdcoder-cn',
    appName: 'SDKWork BirdCoder',
    distributionId: 'cn',
    apiBaseUrl: 'https://cn.sdkwork.local/birdcoder',
  },
  target: {
    url: 'http://127.0.0.1:4173/app',
    platform: 'app',
    channel: 'app.harmony',
    orientation: 'landscape',
    webDevice: null,
    miniProgramPlatform: null,
    appPlatform: 'harmony',
    deviceModel: 'mate-60',
  },
  evidenceKey: 'preview.cn.app.harmony.landscape',
});

console.log('host studio preview contract passed.');
