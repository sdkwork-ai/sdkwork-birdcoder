import {
  getBirdCoderGeneratedAppSdkClient,
  type BirdCoderTokenManagerAwareAppSdkClient,
} from '@sdkwork/birdcoder-pc-infrastructure/services/sdkClients';

export interface BirdCoderAppSdkClients {
  appSdk: BirdCoderTokenManagerAwareAppSdkClient;
}

export function createBirdCoderAppSdkClients(): BirdCoderAppSdkClients {
  return {
    appSdk: getBirdCoderGeneratedAppSdkClient(),
  };
}
