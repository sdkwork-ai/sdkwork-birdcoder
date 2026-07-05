import {
  getBirdCoderGeneratedAppSdkClient,
  type BirdCoderTokenManagerAwareAppSdkClient,
} from '@sdkwork/birdcoder-pc-infrastructure';

export interface BirdCoderAppSdkClients {
  appSdk: BirdCoderTokenManagerAwareAppSdkClient;
}

export function createBirdCoderAppSdkClients(): BirdCoderAppSdkClients {
  return {
    appSdk: getBirdCoderGeneratedAppSdkClient(),
  };
}
