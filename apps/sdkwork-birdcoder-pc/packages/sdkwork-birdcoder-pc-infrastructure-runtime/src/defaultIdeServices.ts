import {
  createBirdCoderDependencyAppSdkClients,
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

function resolveInjectedDependencyClients(
  platformApiGatewayBaseUrl: string | undefined,
  promptsClient: SdkworkPromptsAppClient | undefined,
): BirdCoderDependencyAppSdkClients {
  if (promptsClient) {
    return { promptsClient };
  }

  const createdClients = createBirdCoderDependencyAppSdkClients({
    platformApiGatewayBaseUrl,
  });
  return {
    promptsClient: createdClients.promptsClient,
  };
}

export function configureDefaultBirdCoderIdeServicesRuntime(
  config: BirdCoderDefaultIdeServicesRuntimeConfig = {},
): void {
  const dependencyClients = resolveInjectedDependencyClients(
    config.platformApiGatewayBaseUrl,
    config.promptsClient,
  );
  configureInfrastructureRuntime({
    ...config,
    ...dependencyClients,
  });
}

export function bindDefaultBirdCoderIdeServicesRuntime(
  options: BindDefaultBirdCoderIdeServicesRuntimeOptions = {},
): void {
  const dependencyClients = resolveInjectedDependencyClients(
    options.platformApiGatewayBaseUrl,
    options.promptsClient,
  );
  bindInfrastructureRuntime({
    ...options,
    ...dependencyClients,
  });
}
