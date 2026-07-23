import {
  getBirdCoderAppClient,
  type BirdCoderAppSdkApiClient,
} from '@sdkwork/birdcoder-pc-infrastructure/services/birdCoderSdkClient';

export interface BirdCoderAppSdkClients {
  appSdk: BirdCoderAppSdkApiClient;
}

export function createBirdCoderAppSdkClients(): BirdCoderAppSdkClients {
  return {
    appSdk: getBirdCoderAppClient(),
  };
}
