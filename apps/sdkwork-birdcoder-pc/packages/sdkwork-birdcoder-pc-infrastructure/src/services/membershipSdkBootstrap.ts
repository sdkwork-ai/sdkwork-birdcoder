/**
 * BirdCoder membership SDK bootstrap.
 *
 * Membership and Order remain dependency-owned capabilities. Both SDKs use
 * the platform gateway (or an explicit dependency override) and share the
 * BirdCoder IAM TokenManager.
 */

import {
  bootstrapSdkworkMembershipAppService,
  configureSdkworkMembershipSessionTokenProvider,
  type SdkworkMembershipSessionTokens,
} from '@sdkwork/membership-service';
import { bootstrapSdkworkOrderAppService } from '@sdkwork/order-service';
import { getBirdCoderGlobalTokenManager } from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { resolveBirdCoderDependencySdkBaseUrl } from './sdkBaseUrls.ts';

let membershipSdkBootstrapped = false;

function resolveMembershipApiBaseUrl(): string {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  return resolveBirdCoderDependencySdkBaseUrl('Membership', {
    overrideEnvNames: ['VITE_SDKWORK_MEMBERSHIP_APP_API_BASE_URL'],
    platformApiGatewayBaseUrl: runtimeConfig.platformApiGatewayBaseUrl,
  });
}

function resolveOrderApiBaseUrl(): string {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  return resolveBirdCoderDependencySdkBaseUrl('Order', {
    overrideEnvNames: ['VITE_SDKWORK_ORDER_APP_API_BASE_URL'],
    platformApiGatewayBaseUrl: runtimeConfig.platformApiGatewayBaseUrl,
  });
}

function resolveMembershipSessionTokens(): SdkworkMembershipSessionTokens {
  const tokenManager = getBirdCoderGlobalTokenManager();
  const tokens = tokenManager.getTokens();
  return {
    ...(tokens.accessToken ? { accessToken: tokens.accessToken } : {}),
    ...(tokens.authToken ? { authToken: tokens.authToken } : {}),
    ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
  };
}

/** Missing dependency topology fails before either global service is configured. */
export function bootstrapBirdCoderMembershipSdk(): void {
  if (membershipSdkBootstrapped) {
    return;
  }

  const membershipBaseUrl = resolveMembershipApiBaseUrl();
  const orderBaseUrl = resolveOrderApiBaseUrl();
  const tokenManager = getBirdCoderGlobalTokenManager();

  bootstrapSdkworkMembershipAppService({
    baseUrl: membershipBaseUrl,
    tokenManager,
  });
  bootstrapSdkworkOrderAppService({
    baseUrl: orderBaseUrl,
    tokenManager,
  });
  configureSdkworkMembershipSessionTokenProvider(resolveMembershipSessionTokens);
  membershipSdkBootstrapped = true;
}

export function resetBirdCoderMembershipSdkBootstrap(): void {
  membershipSdkBootstrapped = false;
}
