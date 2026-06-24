import {
  getBirdCoderGeneratedBackendSdkClient,
  type BirdCoderTokenManagerAwareBackendSdkClient,
} from '@sdkwork/birdcoder-pc-admin-core';

export interface BirdCoderAdminSdkClients {
  backendSdk: BirdCoderTokenManagerAwareBackendSdkClient;
}

export function createBirdCoderAdminSdkClients(): BirdCoderAdminSdkClients {
  return {
    backendSdk: getBirdCoderGeneratedBackendSdkClient(),
  };
}
