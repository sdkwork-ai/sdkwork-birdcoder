import { createBirdCoderH5AppSdkClient } from '@sdkwork/birdcoder-h5-core';
import type { BirdCoderH5AppSdkClient } from '@sdkwork/birdcoder-h5-core';

export interface SdkClients {
  appSdk: BirdCoderH5AppSdkClient;
}

export function createSdkClients(): SdkClients {
  return {
    appSdk: createBirdCoderH5AppSdkClient(),
  };
}
