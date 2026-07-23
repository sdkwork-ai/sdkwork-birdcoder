import {
  createClient as createPromptsAppClient,
  type SdkworkPromptsAppClient,
} from '@sdkwork/birdcoder-pc-core/sdk/prompts-app';

import { getBirdCoderGlobalTokenManager } from './appSessionTokenManager.ts';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { resolveBirdCoderDependencySdkBaseUrl } from './sdkBaseUrls.ts';
import { bindBirdCoderSdkSessionErrorHandler } from './sdkSessionErrorHandler.ts';

export type { SdkworkPromptsAppClient };

export interface BirdCoderDependencyAppSdkClients {
  promptsClient: SdkworkPromptsAppClient;
}

export interface CreateBirdCoderDependencyAppSdkClientsOptions {
  platformApiGatewayBaseUrl?: string;
  promptsApiBaseUrl?: string;
}

export function createBirdCoderDependencyAppSdkClients(
  options: CreateBirdCoderDependencyAppSdkClientsOptions = {},
): BirdCoderDependencyAppSdkClients {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  const platformApiGatewayBaseUrl = options.platformApiGatewayBaseUrl
    ?? runtimeConfig.platformApiGatewayBaseUrl;
  const promptsBaseUrl = resolveBirdCoderDependencySdkBaseUrl('Prompts', {
    dependencyApiBaseUrl: options.promptsApiBaseUrl,
    overrideEnvNames: ['VITE_SDKWORK_PROMPTS_APP_API_BASE_URL'],
    platformApiGatewayBaseUrl,
  });
  const tokenManager = getBirdCoderGlobalTokenManager();
  return {
    promptsClient: bindBirdCoderSdkSessionErrorHandler(createPromptsAppClient({
      authMode: 'dual-token',
      baseUrl: promptsBaseUrl,
      platform: 'pc',
      tokenManager,
    })),
  };
}
