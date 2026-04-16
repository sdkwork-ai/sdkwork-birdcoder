import type { BirdHostDescriptor } from '@sdkwork/birdcoder-host-core';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderCoreReadApiClient,
  BirdCoderCoreWriteApiClient,
} from '@sdkwork/birdcoder-types';

export interface BirdCoderDefaultIdeServicesRuntimeConfig {
  apiBaseUrl?: string;
  appAdminClient?: BirdCoderAppAdminApiClient;
  coreReadClient?: BirdCoderCoreReadApiClient;
  coreWriteClient?: BirdCoderCoreWriteApiClient;
}

export interface BindDefaultBirdCoderIdeServicesRuntimeOptions {
  apiBaseUrl?: string;
  appAdminClient?: BirdCoderAppAdminApiClient;
  coreReadClient?: BirdCoderCoreReadApiClient;
  coreWriteClient?: BirdCoderCoreWriteApiClient;
  host?: BirdHostDescriptor;
}

let defaultIdeServicesRuntimeConfig: BirdCoderDefaultIdeServicesRuntimeConfig = {};

function normalizeApiBaseUrl(apiBaseUrl?: string): string | undefined {
  const normalizedApiBaseUrl = apiBaseUrl?.trim();
  return normalizedApiBaseUrl ? normalizedApiBaseUrl : undefined;
}

function resolveBoundApiBaseUrl(
  options: BindDefaultBirdCoderIdeServicesRuntimeOptions,
): string | undefined {
  const explicitApiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl);
  if (explicitApiBaseUrl) {
    return explicitApiBaseUrl;
  }

  return normalizeApiBaseUrl(options.host?.apiBaseUrl);
}

export function getDefaultBirdCoderIdeServicesRuntimeConfig(): BirdCoderDefaultIdeServicesRuntimeConfig {
  return { ...defaultIdeServicesRuntimeConfig };
}

export function configureDefaultBirdCoderIdeServicesRuntime(
  config: BirdCoderDefaultIdeServicesRuntimeConfig = {},
): void {
  defaultIdeServicesRuntimeConfig = {
    appAdminClient: config.appAdminClient,
    coreReadClient: config.coreReadClient,
    coreWriteClient: config.coreWriteClient,
    apiBaseUrl: normalizeApiBaseUrl(config.apiBaseUrl),
  };
}

export function bindDefaultBirdCoderIdeServicesRuntime(
  options: BindDefaultBirdCoderIdeServicesRuntimeOptions = {},
): void {
  configureDefaultBirdCoderIdeServicesRuntime({
    appAdminClient: options.appAdminClient,
    coreReadClient: options.coreReadClient,
    coreWriteClient: options.coreWriteClient,
    apiBaseUrl: resolveBoundApiBaseUrl(options),
  });
}

export function resetDefaultBirdCoderIdeServicesRuntimeForTests(): void {
  defaultIdeServicesRuntimeConfig = {};
}
