import type { BirdHostDescriptor } from '@sdkwork/birdcoder-pc-host-core';
import type {
  BirdCoderAppSdkApiClient,
  BirdCoderBackendSdkApiClient,
} from './sdkClients.ts';

export type BirdCoderRealtimeTransportPreference = 'auto' | 'sse' | 'websocket';

export interface BirdCoderDefaultIdeServicesRuntimeConfig {
  apiBaseUrl?: string;
  appClient?: BirdCoderAppSdkApiClient;
  backendClient?: BirdCoderBackendSdkApiClient;
  executionAuthorityMode?: 'auto' | 'remote-required';
  realtimeTransport?: BirdCoderRealtimeTransportPreference;
}

export interface BindDefaultBirdCoderIdeServicesRuntimeOptions {
  apiBaseUrl?: string;
  appClient?: BirdCoderAppSdkApiClient;
  backendClient?: BirdCoderBackendSdkApiClient;
  executionAuthorityMode?: 'auto' | 'remote-required';
  realtimeTransport?: BirdCoderRealtimeTransportPreference;
  host?: BirdHostDescriptor;
}

let defaultIdeServicesRuntimeConfig: BirdCoderDefaultIdeServicesRuntimeConfig = {};

function normalizeApiBaseUrl(apiBaseUrl?: string): string | undefined {
  const normalizedApiBaseUrl = apiBaseUrl?.trim();
  return normalizedApiBaseUrl ? normalizedApiBaseUrl : undefined;
}

function normalizeRealtimeTransport(
  value?: string,
): BirdCoderRealtimeTransportPreference {
  const normalizedValue = value?.trim().toLowerCase();
  return normalizedValue === 'sse' || normalizedValue === 'websocket'
    ? normalizedValue
    : 'auto';
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
    realtimeTransport: normalizeRealtimeTransport(config.realtimeTransport),
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
    realtimeTransport: options.realtimeTransport,
    apiBaseUrl: resolveBoundApiBaseUrl(options),
  });
}

export function resetDefaultBirdCoderIdeServicesRuntimeForTests(): void {
  defaultIdeServicesRuntimeConfig = {};
}

