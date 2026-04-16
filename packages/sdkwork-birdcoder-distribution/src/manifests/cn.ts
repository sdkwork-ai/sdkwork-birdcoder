import { BIRDCODER_DEFAULT_LOCAL_API_BASE_URL } from '../../../sdkwork-birdcoder-host-core/src/index.ts';
import type { DistributionManifest } from '../index';

export const cnManifest: DistributionManifest = {
  id: 'cn',
  appId: 'sdkwork-birdcoder-cn',
  appName: 'SDKWork BirdCoder',
  bundleIdentifier: 'com.sdkwork.birdcoder.cn',
  updateSource: 'github',
  mirrorStrategy: 'regional',
  apiBaseUrl: BIRDCODER_DEFAULT_LOCAL_API_BASE_URL,
};
