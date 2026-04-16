import { BIRDCODER_DEFAULT_LOCAL_API_BASE_URL } from '../../../sdkwork-birdcoder-host-core/src/index.ts';
import type { DistributionManifest } from '../index';

export const globalManifest: DistributionManifest = {
  id: 'global',
  appId: 'sdkwork-birdcoder',
  appName: 'SDKWork BirdCoder',
  bundleIdentifier: 'com.sdkwork.birdcoder',
  updateSource: 'github',
  mirrorStrategy: 'global',
  apiBaseUrl: BIRDCODER_DEFAULT_LOCAL_API_BASE_URL,
};
