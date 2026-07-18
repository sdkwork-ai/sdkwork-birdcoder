/**
 * BirdCoder membership SDK bootstrap.
 *
 * Integrates `@sdkwork/membership-service` and `@sdkwork/order-service`
 * using the same token-sharing approach as sdkwork-clawrouter: the
 * BirdCoder global TokenManager is passed to both app SDK clients so that
 * all authenticated requests share the same IAM session tokens.
 *
 * The membership SDK service provider is configured globally via
 * `configureSdkworkMembershipAppServiceProvider`, allowing the
 * `@sdkwork/membership-pc-membership` UI components to consume it
 * through `getSdkworkMembershipService()` without explicit injection.
 */

import {
  bootstrapSdkworkMembershipAppService,
  configureSdkworkMembershipSessionTokenProvider,
  type SdkworkMembershipSessionTokens,
} from '@sdkwork/membership-service';
import { bootstrapSdkworkOrderAppService } from '@sdkwork/order-service';
import { getBirdCoderGlobalTokenManager } from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import {
  readBirdCoderRuntimeEnv,
  resolveBirdCoderBrowserDependencySdkBaseUrl,
} from './iamRuntime.ts';

let membershipSdkBootstrapped = false;

function resolveMembershipApiBaseUrl(): string | undefined {
  const configuredBaseUrl = readBirdCoderRuntimeEnv('VITE_SDKWORK_MEMBERSHIP_APP_API_BASE_URL')
    ?? readBirdCoderRuntimeEnv('VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL');
  return configuredBaseUrl
    ? resolveBirdCoderBrowserDependencySdkBaseUrl(configuredBaseUrl)
    : undefined;
}

function resolveOrderApiBaseUrl(): string | undefined {
  return getDefaultBirdCoderIdeServicesRuntimeConfig().apiBaseUrl;
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

/**
 * Bootstraps the membership and order app SDK services using the BirdCoder
 * global TokenManager. Safe to call multiple times — subsequent calls are
 * no-ops once the initial bootstrap completes.
 *
 * @returns `true` when bootstrap ran successfully, `false` when the API
 *   base URL is not yet configured (the caller may retry later).
 */
export function bootstrapBirdCoderMembershipSdk(): boolean {
  if (membershipSdkBootstrapped) {
    return true;
  }

  const membershipBaseUrl = resolveMembershipApiBaseUrl();
  const orderBaseUrl = resolveOrderApiBaseUrl();
  if (!membershipBaseUrl || !orderBaseUrl) {
    return false;
  }

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
  return true;
}

/**
 * Resets the membership SDK bootstrap state. Intended for test teardown.
 */
export function resetBirdCoderMembershipSdkBootstrap(): void {
  membershipSdkBootstrapped = false;
}
