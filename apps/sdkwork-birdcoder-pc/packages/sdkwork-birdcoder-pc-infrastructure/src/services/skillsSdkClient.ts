import {
  createSkillsAppClient,
  type SdkworkSkillsAppClient,
} from '@sdkwork/skills-app-sdk';
import type { AuthTokenManager } from '@sdkwork/sdk-common';
import { getBirdCoderGlobalTokenManager } from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';
import { BIRDCODER_DEFAULT_LOCAL_API_BASE_URL } from '@sdkwork/birdcoder-pc-host-core';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';

export interface BirdCoderSkillsAppSdkClientOptions {
  apiBaseUrl?: string;
  tokenManager?: AuthTokenManager;
}

function resolveSkillsAppApiBaseUrl(explicit?: string): string {
  const normalized = explicit?.trim();
  if (normalized) {
    return normalized;
  }

  return (
    getDefaultBirdCoderIdeServicesRuntimeConfig().apiBaseUrl ??
    BIRDCODER_DEFAULT_LOCAL_API_BASE_URL
  );
}

export function createBirdCoderSkillsAppSdkClient(
  options: BirdCoderSkillsAppSdkClientOptions = {},
): SdkworkSkillsAppClient {
  return createSkillsAppClient({
    authMode: 'dual-token',
    baseUrl: resolveSkillsAppApiBaseUrl(options.apiBaseUrl),
    platform: 'pc',
    tokenManager: options.tokenManager ?? getBirdCoderGlobalTokenManager(),
  });
}
