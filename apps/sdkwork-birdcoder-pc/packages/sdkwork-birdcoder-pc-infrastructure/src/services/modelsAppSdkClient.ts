import type { AuthTokenManager } from '@sdkwork/sdk-common';
import {
  createModelsAppSdkClient,
  type ModelsAppSdkClient,
} from '@sdkwork/birdcoder-pc-core/sdk/models-app';
import { getBirdCoderGlobalTokenManager } from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';

import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { resolveBirdCoderDependencySdkBaseUrl } from './sdkBaseUrls.ts';
import { bindBirdCoderSdkSessionErrorHandler } from './sdkSessionErrorHandler.ts';

export interface BirdCoderModelsAppSdkClientOptions {
  modelsApiBaseUrl?: string;
  platformApiGatewayBaseUrl?: string;
  tokenManager?: AuthTokenManager;
}

export function createBirdCoderModelsAppSdkClient(
  options: BirdCoderModelsAppSdkClientOptions = {},
): ModelsAppSdkClient {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  const baseUrl = resolveBirdCoderDependencySdkBaseUrl('Models', {
    dependencyApiBaseUrl: options.modelsApiBaseUrl,
    overrideEnvNames: ['VITE_SDKWORK_MODELS_APP_API_BASE_URL'],
    platformApiGatewayBaseUrl:
      options.platformApiGatewayBaseUrl ?? runtimeConfig.platformApiGatewayBaseUrl,
  });
  return bindBirdCoderSdkSessionErrorHandler(createModelsAppSdkClient({
    authMode: 'dual-token',
    baseUrl,
    platform: 'pc',
    tokenManager: options.tokenManager ?? getBirdCoderGlobalTokenManager(),
  }));
}
