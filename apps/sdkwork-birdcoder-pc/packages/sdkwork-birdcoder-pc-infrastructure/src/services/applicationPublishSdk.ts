import {
  createDeployAppSdkClient as createDeployAppClient,
  createDeployApplicationPublisher,
  type DeployApplicationPublisher,
} from '@sdkwork/birdcoder-pc-core';

import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { getBirdCoderDriveAppClient } from './iamRuntime.ts';
import { getBirdCoderGlobalTokenManager } from './appSessionTokenManager.ts';
import { resolveBirdCoderDependencySdkBaseUrl } from './sdkBaseUrls.ts';
import { bindBirdCoderSdkSessionErrorHandler } from './sdkSessionErrorHandler.ts';

export function createBirdCoderDeployApplicationPublisher(): DeployApplicationPublisher {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  const deployClient = bindBirdCoderSdkSessionErrorHandler(createDeployAppClient({
    authMode: 'dual-token',
    baseUrl: resolveBirdCoderDependencySdkBaseUrl('Deploy', {
      platformApiGatewayBaseUrl: runtimeConfig.platformApiGatewayBaseUrl,
    }),
    platform: 'pc',
    tokenManager: getBirdCoderGlobalTokenManager(),
  }));

  return createDeployApplicationPublisher({
    deployClient,
    driveClient: getBirdCoderDriveAppClient(),
  });
}
