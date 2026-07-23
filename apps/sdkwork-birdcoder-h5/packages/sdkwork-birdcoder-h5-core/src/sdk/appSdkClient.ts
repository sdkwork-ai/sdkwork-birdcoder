import {
  createClient,
  type BirdCoderAppClient,
} from '@sdkwork/birdcoder-app-sdk';
import { getBirdCoderGlobalTokenManager } from '../bootstrap/tokenManager.ts';
import { resolveBirdCoderH5ApplicationApiBaseUrl } from '../bootstrap/runtimeConfig.ts';

export type BirdCoderH5AppSdkClient = BirdCoderAppClient;

export function createBirdCoderH5AppSdkClient(): BirdCoderH5AppSdkClient {
  const baseUrl = resolveBirdCoderH5ApplicationApiBaseUrl()
    .replace(/\/app\/v3\/api\/?$/u, '');
  return createClient({
    authMode: 'dual-token',
    baseUrl,
    platform: 'h5',
    tokenManager: getBirdCoderGlobalTokenManager(),
  });
}
