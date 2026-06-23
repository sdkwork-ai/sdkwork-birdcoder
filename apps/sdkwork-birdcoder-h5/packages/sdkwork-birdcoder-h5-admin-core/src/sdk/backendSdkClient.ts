import {
  getBirdCoderGeneratedBackendSdkClient,
  type BirdCoderTokenManagerAwareBackendSdkClient,
} from '@sdkwork/birdcoder-pc-infrastructure';

export type BirdCoderH5BackendSdkClient = BirdCoderTokenManagerAwareBackendSdkClient;

export function createBirdCoderH5BackendSdkClient(): BirdCoderH5BackendSdkClient {
  return getBirdCoderGeneratedBackendSdkClient();
}
