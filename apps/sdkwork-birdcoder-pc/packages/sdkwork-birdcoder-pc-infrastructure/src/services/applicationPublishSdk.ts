import { createClient as createDeployAppClient } from '@sdkwork/deployments-app-sdk';
import {
  createDeployApplicationPublisher,
  type DeployApplicationPublisher,
} from '@sdkwork/deployments-app-sdk/application-publisher';

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
