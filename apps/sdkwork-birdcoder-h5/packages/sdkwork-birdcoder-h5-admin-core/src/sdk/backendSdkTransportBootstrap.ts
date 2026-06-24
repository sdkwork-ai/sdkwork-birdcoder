import { registerBirdCoderBackendSdkTransportResolver } from '@sdkwork/birdcoder-pc-admin-core';
import {
  getBirdCoderGlobalTokenManager as getCoreBirdCoderGlobalTokenManager,
} from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';
import {
  createBirdCoderHttpApiTransport,
  getDefaultBirdCoderIdeServicesRuntimeConfig,
} from '@sdkwork/birdcoder-pc-infrastructure';

function buildBirdCoderTokenManagerHeaders(
  tokenManager: ReturnType<typeof getCoreBirdCoderGlobalTokenManager> | undefined,
): Record<string, string | undefined> {
  const tokens = tokenManager?.getTokens();
  return {
    Authorization: tokens?.authToken ? `Bearer ${tokens.authToken}` : undefined,
    'Access-Token': tokens?.accessToken,
    'Refresh-Token': tokens?.refreshToken,
  };
}

registerBirdCoderBackendSdkTransportResolver((options, tokenManagerRef) => {
  if (options.transport) {
    return options.transport;
  }

  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  const baseUrl = options.apiBaseUrl ?? runtimeConfig.apiBaseUrl;
  if (baseUrl) {
    return createBirdCoderHttpApiTransport({
      baseUrl,
      resolveHeaders: () => buildBirdCoderTokenManagerHeaders(tokenManagerRef.current),
      timeoutMs: options.timeoutMs,
    });
  }

  return {
    async request(request) {
      throw new Error(
        `BirdCoder generated backend SDK client is unavailable. Configure a backend API base URL or explicit transport before using ${request.method} ${request.path}.`,
      );
    },
  };
});
