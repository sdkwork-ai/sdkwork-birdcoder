import {
  createClient as createDocumentsAppClient,
  type SdkworkDocumentsAppClient,
} from '@sdkwork/birdcoder-pc-core/sdk/documents-app';
import {
  createClient as createPromptsAppClient,
  type SdkworkPromptsAppClient,
} from '@sdkwork/birdcoder-pc-core/sdk/prompts-app';

import { getBirdCoderGlobalTokenManager } from './appSessionTokenManager.ts';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { resolveBirdCoderDependencySdkBaseUrl } from './sdkBaseUrls.ts';
import { bindBirdCoderSdkSessionErrorHandler } from './sdkSessionErrorHandler.ts';

export type { SdkworkDocumentsAppClient, SdkworkPromptsAppClient };

export interface BirdCoderDependencyAppSdkClients {
  documentsClient: SdkworkDocumentsAppClient;
  promptsClient: SdkworkPromptsAppClient;
}

export interface CreateBirdCoderDependencyAppSdkClientsOptions {
  documentsApiBaseUrl?: string;
  platformApiGatewayBaseUrl?: string;
  promptsApiBaseUrl?: string;
}

export function createBirdCoderDocumentsAppSdkClient(
  options: CreateBirdCoderDependencyAppSdkClientsOptions = {},
): SdkworkDocumentsAppClient {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  const baseUrl = resolveBirdCoderDependencySdkBaseUrl('Documents', {
    dependencyApiBaseUrl: options.documentsApiBaseUrl,
    overrideEnvNames: ['VITE_SDKWORK_DOCUMENTS_APP_API_BASE_URL'],
    platformApiGatewayBaseUrl:
      options.platformApiGatewayBaseUrl ?? runtimeConfig.platformApiGatewayBaseUrl,
  });
  return bindBirdCoderSdkSessionErrorHandler(createDocumentsAppClient({
    authMode: 'dual-token',
    baseUrl,
    platform: 'pc',
    tokenManager: getBirdCoderGlobalTokenManager(),
  }));
}

export function createBirdCoderPromptsAppSdkClient(
  options: CreateBirdCoderDependencyAppSdkClientsOptions = {},
): SdkworkPromptsAppClient {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  const baseUrl = resolveBirdCoderDependencySdkBaseUrl('Prompts', {
    dependencyApiBaseUrl: options.promptsApiBaseUrl,
    overrideEnvNames: ['VITE_SDKWORK_PROMPTS_APP_API_BASE_URL'],
    platformApiGatewayBaseUrl:
      options.platformApiGatewayBaseUrl ?? runtimeConfig.platformApiGatewayBaseUrl,
  });
  return bindBirdCoderSdkSessionErrorHandler(createPromptsAppClient({
    authMode: 'dual-token',
    baseUrl,
    platform: 'pc',
    tokenManager: getBirdCoderGlobalTokenManager(),
  }));
}

export function createBirdCoderDependencyAppSdkClients(
  options: CreateBirdCoderDependencyAppSdkClientsOptions = {},
): BirdCoderDependencyAppSdkClients {
  return {
    documentsClient: createBirdCoderDocumentsAppSdkClient(options),
    promptsClient: createBirdCoderPromptsAppSdkClient(options),
  };
}
