import {
  getBirdCoderGeneratedAppSdkClient,
  type BirdCoderTokenManagerAwareAppSdkClient,
} from '@sdkwork/birdcoder-pc-infrastructure';

export type BirdCoderH5AppSdkClient = BirdCoderTokenManagerAwareAppSdkClient;

export function createBirdCoderH5AppSdkClient(): BirdCoderH5AppSdkClient {
  return getBirdCoderGeneratedAppSdkClient();
}
