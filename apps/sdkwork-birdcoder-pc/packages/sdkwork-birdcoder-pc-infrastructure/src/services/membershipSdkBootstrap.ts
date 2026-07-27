/**
 * BirdCoder membership SDK bootstrap.
 *
 * Membership and Order remain dependency-owned capabilities. Standalone uses
 * their owner assembly contributions through the application ingress; cloud
 * uses the platform gateway or an explicit dependency override. Both SDKs
 * share the BirdCoder IAM TokenManager.
 */

import {
  bootstrapSdkworkMembershipAppService,
  configureSdkworkMembershipAppServiceProvider,
  configureSdkworkMembershipSessionTokenProvider,
  type SdkworkMembershipSessionTokens,
} from '@sdkwork/membership-service';
import {
  bootstrapSdkworkOrderAppService,
  configureSdkworkOrderAppServiceProvider,
  configureSdkworkOrderSessionTokenProvider,
  createSdkworkCouponRechargeService,
  createSdkworkMembershipCheckoutService,
  createSdkworkPointsRechargeService,
  type SdkworkCouponRechargeService,
  type SdkworkMembershipCheckoutService,
  type SdkworkPointsRechargeService,
} from '@sdkwork/order-service';
import { getBirdCoderGlobalTokenManager } from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { resolveBirdCoderDependencySdkBaseUrl } from './sdkBaseUrls.ts';

let membershipSdkBootstrapped = false;
let couponRechargeService: SdkworkCouponRechargeService | null = null;
let membershipCheckoutService: SdkworkMembershipCheckoutService | null = null;
let pointsRechargeService: SdkworkPointsRechargeService | null = null;

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
  const orderAppService = bootstrapSdkworkOrderAppService({
    baseUrl: orderBaseUrl,
    tokenManager,
  });
  membershipCheckoutService = createSdkworkMembershipCheckoutService({
    appService: orderAppService,
  });
  pointsRechargeService = createSdkworkPointsRechargeService({
    appService: orderAppService,
  });
  couponRechargeService = createSdkworkCouponRechargeService({
    appService: orderAppService,
  });
  configureSdkworkMembershipSessionTokenProvider(resolveMembershipSessionTokens);
  configureSdkworkOrderSessionTokenProvider(resolveMembershipSessionTokens);
  membershipSdkBootstrapped = true;
}

export function getBirdCoderMembershipCheckoutService(): SdkworkMembershipCheckoutService {
  if (!membershipCheckoutService) {
    throw new Error('BirdCoder membership checkout service is not configured.');
  }
  return membershipCheckoutService;
}

export function getBirdCoderPointsRechargeService(): SdkworkPointsRechargeService {
  if (!pointsRechargeService) {
    throw new Error('BirdCoder points recharge service is not configured.');
  }
  return pointsRechargeService;
}

export function getBirdCoderCouponRechargeService(): SdkworkCouponRechargeService {
  if (!couponRechargeService) {
    throw new Error('BirdCoder coupon recharge service is not configured.');
  }
  return couponRechargeService;
}

export function resetBirdCoderMembershipSdkBootstrap(): void {
  configureSdkworkMembershipAppServiceProvider(null);
  configureSdkworkMembershipSessionTokenProvider(null);
  configureSdkworkOrderAppServiceProvider(null);
  configureSdkworkOrderSessionTokenProvider(null);
  couponRechargeService = null;
  membershipCheckoutService = null;
  pointsRechargeService = null;
  membershipSdkBootstrapped = false;
}
