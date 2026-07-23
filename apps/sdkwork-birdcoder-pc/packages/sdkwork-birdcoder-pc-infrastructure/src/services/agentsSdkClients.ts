import type { AuthTokenManager } from '@sdkwork/sdk-common';
import {
  createAgentsAppSdkClient,
  type AgentsAppSdkClient,
} from '@sdkwork/birdcoder-pc-core/sdk';
import { getBirdCoderGlobalTokenManager } from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { resolveBirdCoderPlatformSdkBaseUrl } from './sdkBaseUrls.ts';
import { bindBirdCoderSdkSessionErrorHandler } from './sdkSessionErrorHandler.ts';

export interface BirdCoderAgentsAppSdkClientOptions {
  platformApiGatewayBaseUrl?: string;
  tokenManager?: AuthTokenManager;
}

let agentsAppClient: AgentsAppSdkClient | null = null;

export function createBirdCoderAgentsAppSdkClient(
  options: BirdCoderAgentsAppSdkClientOptions = {},
): AgentsAppSdkClient {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  return bindBirdCoderSdkSessionErrorHandler(createAgentsAppSdkClient({
    authMode: 'dual-token',
    baseUrl: resolveBirdCoderPlatformSdkBaseUrl(
      options.platformApiGatewayBaseUrl ?? runtimeConfig.platformApiGatewayBaseUrl,
    ),
    platform: 'pc',
    tokenManager: options.tokenManager ?? getBirdCoderGlobalTokenManager(),
  }));
}

export function getBirdCoderAgentsAppSdkClient(
  options: BirdCoderAgentsAppSdkClientOptions = {},
): AgentsAppSdkClient {
  if (options.platformApiGatewayBaseUrl || options.tokenManager) {
    return createBirdCoderAgentsAppSdkClient(options);
  }

  if (!agentsAppClient) {
    agentsAppClient = createBirdCoderAgentsAppSdkClient();
  }
  return agentsAppClient;
}

export function resetBirdCoderAgentsAppSdkClient(): void {
  agentsAppClient = null;
}
