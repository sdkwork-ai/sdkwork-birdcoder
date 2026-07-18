import { registerBirdCoderBackendSdkTransportResolver } from '@sdkwork/birdcoder-pc-admin-core/sdk/backendGeneratedSdkClient';
import {
  getBirdCoderGlobalTokenManager as getCoreBirdCoderGlobalTokenManager,
} from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';
import { createBirdCoderHttpApiTransport } from '@sdkwork/birdcoder-pc-infrastructure/services/sdkTransportShared';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from '@sdkwork/birdcoder-pc-infrastructure/services/defaultIdeServicesRuntime';
import { buildAuthHeaders } from '@sdkwork/sdk-common';

function buildBirdCoderTokenManagerHeaders(
  tokenManager: ReturnType<typeof getCoreBirdCoderGlobalTokenManager> | undefined,
): Record<string, string | undefined> {
  return buildAuthHeaders('dual-token', undefined, tokenManager);
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
