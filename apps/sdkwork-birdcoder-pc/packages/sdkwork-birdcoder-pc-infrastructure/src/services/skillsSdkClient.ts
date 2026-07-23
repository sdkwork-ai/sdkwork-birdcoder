import {
  createSkillsAppClient,
  type SdkworkSkillsAppClient,
} from '@sdkwork/birdcoder-pc-core/sdk/skills-app';
import type { AuthTokenManager } from '@sdkwork/sdk-common';
import { getBirdCoderGlobalTokenManager } from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { resolveBirdCoderPlatformSdkBaseUrl } from './sdkBaseUrls.ts';
import { bindBirdCoderSdkSessionErrorHandler } from './sdkSessionErrorHandler.ts';

export interface BirdCoderSkillsAppSdkClientOptions {
  platformApiGatewayBaseUrl?: string;
  tokenManager?: AuthTokenManager;
}

export function createBirdCoderSkillsAppSdkClient(
  options: BirdCoderSkillsAppSdkClientOptions = {},
): SdkworkSkillsAppClient {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  return bindBirdCoderSdkSessionErrorHandler(createSkillsAppClient({
    authMode: 'dual-token',
    baseUrl: resolveBirdCoderPlatformSdkBaseUrl(
      options.platformApiGatewayBaseUrl ?? runtimeConfig.platformApiGatewayBaseUrl,
    ),
    platform: 'pc',
    tokenManager: options.tokenManager ?? getBirdCoderGlobalTokenManager(),
  }));
}
