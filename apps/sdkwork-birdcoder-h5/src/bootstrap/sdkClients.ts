import {
  getBirdCoderGeneratedAppSdkClient,
  getBirdCoderGeneratedBackendSdkClient,
  type BirdCoderTokenManagerAwareAppSdkClient,
  type BirdCoderTokenManagerAwareBackendSdkClient,
} from '@sdkwork/birdcoder-pc-infrastructure';

export interface SdkClients {
  appSdk: BirdCoderTokenManagerAwareAppSdkClient;
  backendSdk: BirdCoderTokenManagerAwareBackendSdkClient;
}

export function createSdkClients(): SdkClients {
  return {
    appSdk: getBirdCoderGeneratedAppSdkClient(),
    backendSdk: getBirdCoderGeneratedBackendSdkClient(),
  };
}
