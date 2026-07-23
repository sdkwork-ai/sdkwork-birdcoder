import {
  createTokenManager,
  type AuthTokenManager,
} from '@sdkwork/sdk-common';

interface BirdCoderH5TokenManagerHost {
  __SDKWORK_BIRDCODER_H5_TOKEN_MANAGER__?: AuthTokenManager;
}

export type BirdCoderTokenManager = AuthTokenManager;

export function getBirdCoderGlobalTokenManager(): AuthTokenManager {
  const host = globalThis as typeof globalThis & BirdCoderH5TokenManagerHost;
  host.__SDKWORK_BIRDCODER_H5_TOKEN_MANAGER__ ??= createTokenManager();
  return host.__SDKWORK_BIRDCODER_H5_TOKEN_MANAGER__;
}
