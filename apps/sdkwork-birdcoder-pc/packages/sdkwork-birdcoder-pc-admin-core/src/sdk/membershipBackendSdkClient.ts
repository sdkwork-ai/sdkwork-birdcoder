import {
  createClient,
  type SdkworkMembershipBackendClient,
} from '@sdkwork/membership-backend-sdk';
import { getBirdCoderGlobalTokenManager } from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';
import type { AuthTokenManager } from '@sdkwork/sdk-common';

export interface CreateBirdCoderMembershipBackendSdkClientOptions {
  baseUrl: string;
  tokenManager?: AuthTokenManager;
}

export function createBirdCoderMembershipBackendSdkClient(
  options: CreateBirdCoderMembershipBackendSdkClientOptions,
): SdkworkMembershipBackendClient {
  return createClient({
    authMode: 'dual-token',
    baseUrl: options.baseUrl,
    tokenManager: options.tokenManager ?? getBirdCoderGlobalTokenManager(),
  });
}
