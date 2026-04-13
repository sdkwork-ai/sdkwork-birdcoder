import type { DistributionManifest } from '../index';

export const cnManifest: DistributionManifest = {
  id: 'cn',
  appId: 'sdkwork-birdcoder-cn',
  appName: 'SDKWork BirdCoder',
  bundleIdentifier: 'com.sdkwork.birdcoder.cn',
  updateSource: 'github',
  mirrorStrategy: 'regional',
  apiBaseUrl: 'https://cn.sdkwork.local/birdcoder/api',
};
