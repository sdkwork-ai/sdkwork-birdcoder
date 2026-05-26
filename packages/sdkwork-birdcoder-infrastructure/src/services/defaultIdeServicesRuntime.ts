import type { BirdHostDescriptor } from '@sdkwork/birdcoder-host-core';
import type {
  BirdCoderAppSdkApiClient,
  BirdCoderBackendSdkApiClient,
} from './sdkClients.ts';

export interface BirdCoderDefaultIdeServicesRuntimeConfig {
  apiBaseUrl?: string;
  appClient?: BirdCoderAppSdkApiClient;
  backendClient?: BirdCoderBackendSdkApiClient;
  executionAuthorityMode?: 'auto' | 'remote-required';
}

export interface BindDefaultBirdCoderIdeServicesRuntimeOptions {
  apiBaseUrl?: string;
  appClient?: BirdCoderAppSdkApiClient;
  backendClient?: BirdCoderBackendSdkApiClient;
  executionAuthorityMode?: 'auto' | 'remote-required';
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

function resolveExecutionAuthorityMode(
  options: BindDefaultBirdCoderIdeServicesRuntimeOptions,
): 'auto' | 'remote-required' {
  if (options.executionAuthorityMode) {
    return options.executionAuthorityMode;
  }

  if (
    resolveBoundApiBaseUrl(options) ||
    options.appClient ||
    options.backendClient
  ) {
    return 'remote-required';
  }

  return 'auto';
}

export function getDefaultBirdCoderIdeServicesRuntimeConfig(): BirdCoderDefaultIdeServicesRuntimeConfig {
  return {
    ...defaultIdeServicesRuntimeConfig,
  };
}

export function configureDefaultBirdCoderIdeServicesRuntime(
  config: BirdCoderDefaultIdeServicesRuntimeConfig = {},
): void {
  defaultIdeServicesRuntimeConfig = {
    appClient: config.appClient,
    backendClient: config.backendClient,
    executionAuthorityMode: config.executionAuthorityMode ?? 'auto',
    apiBaseUrl: normalizeApiBaseUrl(config.apiBaseUrl),
  };
}

export function bindDefaultBirdCoderIdeServicesRuntime(
  options: BindDefaultBirdCoderIdeServicesRuntimeOptions = {},
): void {
  configureDefaultBirdCoderIdeServicesRuntime({
    appClient: options.appClient,
    backendClient: options.backendClient,
    executionAuthorityMode: resolveExecutionAuthorityMode(options),
    apiBaseUrl: resolveBoundApiBaseUrl(options),
  });
}

export function resetDefaultBirdCoderIdeServicesRuntimeForTests(): void {
  defaultIdeServicesRuntimeConfig = {};
}
