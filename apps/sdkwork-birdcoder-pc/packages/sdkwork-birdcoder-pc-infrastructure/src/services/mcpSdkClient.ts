import type { AuthTokenManager } from '@sdkwork/sdk-common';
import {
  createMcpAppSdkClient,
  type McpAppSdkClient,
} from '@sdkwork/birdcoder-pc-core/sdk/mcp-app';
import { getBirdCoderGlobalTokenManager } from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { resolveBirdCoderDependencySdkBaseUrl } from './sdkBaseUrls.ts';
import { bindBirdCoderSdkSessionErrorHandler } from './sdkSessionErrorHandler.ts';

export interface BirdCoderMcpAppSdkClientOptions {
  mcpApiBaseUrl?: string;
  platformApiGatewayBaseUrl?: string;
  tokenManager?: AuthTokenManager;
}

export function createBirdCoderMcpAppSdkClient(
  options: BirdCoderMcpAppSdkClientOptions = {},
): McpAppSdkClient {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  return bindBirdCoderSdkSessionErrorHandler(createMcpAppSdkClient({
    authMode: 'dual-token',
    baseUrl: resolveBirdCoderDependencySdkBaseUrl('MCP', {
      dependencyApiBaseUrl: options.mcpApiBaseUrl,
      overrideEnvNames: ['VITE_SDKWORK_MCP_APP_API_BASE_URL'],
      platformApiGatewayBaseUrl:
        options.platformApiGatewayBaseUrl ?? runtimeConfig.platformApiGatewayBaseUrl,
    }),
    platform: 'pc',
    tokenManager: options.tokenManager ?? getBirdCoderGlobalTokenManager(),
  }));
}
