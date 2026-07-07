import type { AuthTokenManager } from '@sdkwork/sdk-common';
import {
  createAgentsAppSdkClient,
  type AgentsAppSdkClient,
} from '@sdkwork/birdcoder-pc-core/sdk';
import { BIRDCODER_DEFAULT_LOCAL_API_BASE_URL } from '@sdkwork/birdcoder-pc-host-core';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';

export interface BirdCoderAgentsAppSdkClientOptions {
  apiBaseUrl?: string;
  tokenManager?: AuthTokenManager;
}

let agentsAppClient: AgentsAppSdkClient | null = null;

function resolveAgentsAppApiBaseUrl(explicit?: string): string {
  const normalized = explicit?.trim();
  if (normalized) {
    return normalized;
  }

  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  return runtimeConfig.apiBaseUrl ?? BIRDCODER_DEFAULT_LOCAL_API_BASE_URL;
}

export function createBirdCoderAgentsAppSdkClient(
  options: BirdCoderAgentsAppSdkClientOptions = {},
): AgentsAppSdkClient {
  return createAgentsAppSdkClient({
    authMode: 'dual-token',
    baseUrl: resolveAgentsAppApiBaseUrl(options.apiBaseUrl),
    platform: 'pc',
    tokenManager: options.tokenManager,
  });
}

export function getBirdCoderAgentsAppSdkClient(
  options: BirdCoderAgentsAppSdkClientOptions = {},
): AgentsAppSdkClient {
  if (options.apiBaseUrl || options.tokenManager) {
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
