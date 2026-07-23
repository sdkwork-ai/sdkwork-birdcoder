import {
  handleSdkworkSessionAuthUnauthorizedError,
  resetSdkworkSessionAuthRedirectState,
} from '@sdkwork/auth-runtime-pc-react/handleSdkworkSessionAuthUnauthorizedError';
import { isSdkworkSdkSessionAuthError } from '@sdkwork/auth-runtime-pc-react/sdkSessionAuthError';
import { getBirdCoderGlobalTokenManager } from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';
import { redirectBrowserToBirdCoderProtectedLogin } from '@sdkwork/birdcoder-pc-core/appSessionAuthRedirect';

import {
  clearStoredAppSessionToken,
} from './appSessionToken.ts';
import {
  invalidateBirdCoderCurrentSession,
} from './iamCurrentSession.ts';
import {
  invalidateBirdCoderCurrentUser,
} from './iamCurrentUser.ts';

export function resetBirdCoderSdkSessionAuthRedirectState(): void {
  resetSdkworkSessionAuthRedirectState();
}

export function isBirdCoderSdkSessionAuthError(error: unknown): boolean {
  return isSdkworkSdkSessionAuthError(error);
}

export function clearBirdCoderAppSessionState(): void {
  getBirdCoderGlobalTokenManager().clearTokens();
  invalidateBirdCoderCurrentSession();
  invalidateBirdCoderCurrentUser();
  clearStoredAppSessionToken();
}

export function terminateBirdCoderAppSessionAfterRefreshFailure(): void {
  clearBirdCoderAppSessionState();
  redirectBrowserToBirdCoderProtectedLogin();
}

export function handleBirdCoderSdkSessionAuthError(error: unknown): boolean {
  return handleSdkworkSessionAuthUnauthorizedError(error, {
    clearSession: clearBirdCoderAppSessionState,
    redirectToLogin: redirectBrowserToBirdCoderProtectedLogin,
  });
}
