import {
  createBirdCoderDependencyAppSdkClients,
  createBirdCoderPromptsAppSdkClient,
  type BirdCoderDependencyAppSdkClients,
  type SdkworkPromptsAppClient,
} from '@sdkwork/birdcoder-pc-infrastructure/services/dependencyAppSdkClients';
import {
  bindDefaultBirdCoderIdeServicesRuntime as bindInfrastructureRuntime,
  configureDefaultBirdCoderIdeServicesRuntime as configureInfrastructureRuntime,
  getDefaultBirdCoderIdeServicesRuntimeConfig,
  resetDefaultBirdCoderIdeServicesRuntimeForTests,
  type BindDefaultBirdCoderIdeServicesRuntimeOptions,
  type BirdCoderDefaultIdeServicesRuntimeConfig,
} from '@sdkwork/birdcoder-pc-infrastructure/services/defaultIdeServicesRuntime';
import { loadDefaultBirdCoderIdeService } from '@sdkwork/birdcoder-pc-infrastructure/services/lazyDefaultIdeServices';

export type {
  BindDefaultBirdCoderIdeServicesRuntimeOptions,
  BirdCoderDefaultIdeServicesRuntimeConfig,
};
export {
  createBirdCoderDependencyAppSdkClients,
  getDefaultBirdCoderIdeServicesRuntimeConfig,
  loadDefaultBirdCoderIdeService,
  resetDefaultBirdCoderIdeServicesRuntimeForTests,
};

export type { BirdCoderDependencyAppSdkClients };

function resolvePromptsClient(
  platformApiGatewayBaseUrl: string | undefined,
  promptsClient: SdkworkPromptsAppClient | undefined,
): SdkworkPromptsAppClient {
  if (promptsClient) {
    return promptsClient;
  }

  return createBirdCoderPromptsAppSdkClient({
    platformApiGatewayBaseUrl,
  });
}

export function configureDefaultBirdCoderIdeServicesRuntime(
  config: BirdCoderDefaultIdeServicesRuntimeConfig = {},
): void {
  const promptsClient = resolvePromptsClient(
    config.platformApiGatewayBaseUrl,
    config.promptsClient,
  );
  configureInfrastructureRuntime({
    ...config,
    promptsClient,
  });
}

export function bindDefaultBirdCoderIdeServicesRuntime(
  options: BindDefaultBirdCoderIdeServicesRuntimeOptions = {},
): void {
  const promptsClient = resolvePromptsClient(
    options.platformApiGatewayBaseUrl,
    options.promptsClient,
  );
  bindInfrastructureRuntime({
    ...options,
    promptsClient,
  });
}
