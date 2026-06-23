import { createBirdCoderH5AppSdkClient } from '@sdkwork/birdcoder-h5-core';
import { createBirdCoderH5BackendSdkClient } from '@sdkwork/birdcoder-h5-admin-core';
import type { BirdCoderH5AppSdkClient } from '@sdkwork/birdcoder-h5-core';
import type { BirdCoderH5BackendSdkClient } from '@sdkwork/birdcoder-h5-admin-core';

export interface SdkClients {
  appSdk: BirdCoderH5AppSdkClient;
  backendSdk: BirdCoderH5BackendSdkClient;
}

export function createSdkClients(): SdkClients {
  return {
    appSdk: createBirdCoderH5AppSdkClient(),
    backendSdk: createBirdCoderH5BackendSdkClient(),
  };
}
