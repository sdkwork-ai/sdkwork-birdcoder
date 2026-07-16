import { refreshBirdCoderAppSessionNow } from './appSessionRefresh.ts';
import {
  isBirdCoderSdkSessionAuthError,
  terminateBirdCoderAppSessionAfterRefreshFailure,
} from './sdkClients.ts';

export interface BirdCoderProtectedOperationRecoveryOptions {
  retryAfterRefresh?: boolean;
}

export async function executeBirdCoderProtectedOperationWithRecovery<T>(
  operation: () => Promise<T>,
  options: BirdCoderProtectedOperationRecoveryOptions = {},
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isBirdCoderSdkSessionAuthError(error)) {
      throw error;
    }

    const refreshed = await refreshBirdCoderAppSessionNow();
    if (!refreshed || !options.retryAfterRefresh) {
      throw error;
    }

    try {
      return await operation();
    } catch (retryError) {
      if (isBirdCoderSdkSessionAuthError(retryError)) {
        terminateBirdCoderAppSessionAfterRefreshFailure();
      }
      throw retryError;
    }
  }
}
