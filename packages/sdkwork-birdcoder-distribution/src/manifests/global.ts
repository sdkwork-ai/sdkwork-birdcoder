import type { DistributionManifest } from '../index';

export const globalManifest: DistributionManifest = {
  id: 'global',
  appId: 'sdkwork-birdcoder',
  appName: 'SDKWork BirdCoder',
  bundleIdentifier: 'com.sdkwork.birdcoder',
  updateSource: 'github',
  mirrorStrategy: 'global',
  apiBaseUrl: 'https://api.sdkwork.com/birdcoder',
};
