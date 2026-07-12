import {
  getBirdCoderGeneratedAppSdkClient,
  type BirdCoderTokenManagerAwareAppSdkClient,
} from '@sdkwork/birdcoder-pc-infrastructure/services/sdkClients';

export type BirdCoderH5AppSdkClient = BirdCoderTokenManagerAwareAppSdkClient;

export function createBirdCoderH5AppSdkClient(): BirdCoderH5AppSdkClient {
  return getBirdCoderGeneratedAppSdkClient();
}
