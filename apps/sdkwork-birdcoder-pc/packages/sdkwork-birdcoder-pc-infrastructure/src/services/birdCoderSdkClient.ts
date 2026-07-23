import type { AuthTokenManager } from '@sdkwork/sdk-common';
import {
  createClient,
  type BirdCoderAppClient,
} from '@sdkwork/birdcoder-pc-core/sdk/birdcoder-app';
import {
  getBirdCoderGlobalTokenManager,
  setBirdCoderGlobalTokenManager,
} from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { resolveBirdCoderApplicationSdkBaseUrl } from './sdkBaseUrls.ts';
import { bindBirdCoderSdkSessionErrorHandler } from './sdkSessionErrorHandler.ts';

export interface BirdCoderAppClientOptions {
  applicationApiBaseUrl?: string;
  tokenManager?: AuthTokenManager;
}

export type BirdCoderAppSdkApiClient = BirdCoderAppClient;

let sharedClient: BirdCoderAppClient | null = null;

export function createBirdCoderAppClient(
  options: BirdCoderAppClientOptions = {},
): BirdCoderAppClient {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  return bindBirdCoderSdkSessionErrorHandler(createClient({
    authMode: 'dual-token',
    baseUrl: resolveBirdCoderApplicationSdkBaseUrl(
      options.applicationApiBaseUrl ?? runtimeConfig.applicationApiBaseUrl,
    ),
    platform: 'pc',
    tokenManager: options.tokenManager ?? getBirdCoderGlobalTokenManager(),
  }));
}

export function getBirdCoderAppClient(
  options: BirdCoderAppClientOptions = {},
): BirdCoderAppClient {
  if (options.applicationApiBaseUrl || options.tokenManager) {
    return createBirdCoderAppClient(options);
  }
  sharedClient ??= createBirdCoderAppClient();
  return sharedClient;
}

export function resetBirdCoderAppClient(): void {
  sharedClient = null;
}

export function setBirdCoderAppClientTokenManager(tokenManager: AuthTokenManager): void {
  setBirdCoderGlobalTokenManager(tokenManager);
  sharedClient?.setTokenManager(tokenManager);
}
