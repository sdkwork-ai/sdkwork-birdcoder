import type { BirdHostDescriptor } from '@sdkwork/birdcoder-host-core';
import type { BirdCoderRuntimeUserCenterProviderKind } from '@sdkwork/birdcoder-core';
import {
  resolveBirdCoderRuntimeUserCenterProviderKind,
} from '@sdkwork/birdcoder-core';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderCoreReadApiClient,
  BirdCoderCoreWriteApiClient,
  BirdCoderUserCenterMetadataSummary,
} from '@sdkwork/birdcoder-types';

export interface BirdCoderRuntimeUserCenterBindingConfig {
  baseUrl?: string;
  providerKey?: string;
  providerKind?: BirdCoderRuntimeUserCenterProviderKind;
}

export interface BirdCoderDefaultIdeServicesRuntimeConfig {
  apiBaseUrl?: string;
  appAdminClient?: BirdCoderAppAdminApiClient;
  coreReadClient?: BirdCoderCoreReadApiClient;
  coreWriteClient?: BirdCoderCoreWriteApiClient;
  executionAuthorityMode?: 'auto' | 'remote-required';
  userCenter?: BirdCoderRuntimeUserCenterBindingConfig;
}

export interface BindDefaultBirdCoderIdeServicesRuntimeOptions {
  apiBaseUrl?: string;
  appAdminClient?: BirdCoderAppAdminApiClient;
  coreReadClient?: BirdCoderCoreReadApiClient;
  coreWriteClient?: BirdCoderCoreWriteApiClient;
  executionAuthorityMode?: 'auto' | 'remote-required';
  host?: BirdHostDescriptor;
  userCenter?: BirdCoderRuntimeUserCenterBindingConfig;
}

let defaultIdeServicesRuntimeConfig: BirdCoderDefaultIdeServicesRuntimeConfig = {};

function normalizeApiBaseUrl(apiBaseUrl?: string): string | undefined {
  const normalizedApiBaseUrl = apiBaseUrl?.trim();
  return normalizedApiBaseUrl ? normalizedApiBaseUrl : undefined;
}

function normalizeUserCenterRuntimeConfig(
  config?: BirdCoderRuntimeUserCenterBindingConfig,
): BirdCoderRuntimeUserCenterBindingConfig | undefined {
  if (!config) {
    return undefined;
  }

  const baseUrl = normalizeApiBaseUrl(config.baseUrl);
  const providerKey = config.providerKey?.trim() || undefined;
  const providerKind =
    baseUrl || providerKey || config.providerKind
      ? resolveBirdCoderRuntimeUserCenterProviderKind(config.providerKind)
      : undefined;

  if (!baseUrl && !providerKey && !providerKind) {
    return undefined;
  }

  return {
    ...(baseUrl ? { baseUrl } : {}),
    ...(providerKey ? { providerKey } : {}),
    ...(providerKind ? { providerKind } : {}),
  };
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
    options.appAdminClient ||
    options.coreReadClient ||
    options.coreWriteClient
  ) {
    return 'remote-required';
  }

  return 'auto';
}

export function getDefaultBirdCoderIdeServicesRuntimeConfig(): BirdCoderDefaultIdeServicesRuntimeConfig {
  return {
    ...defaultIdeServicesRuntimeConfig,
    ...(defaultIdeServicesRuntimeConfig.userCenter
      ? {
          userCenter: {
            ...defaultIdeServicesRuntimeConfig.userCenter,
          },
        }
      : {}),
  };
}

export function configureDefaultBirdCoderIdeServicesRuntime(
  config: BirdCoderDefaultIdeServicesRuntimeConfig = {},
): void {
  defaultIdeServicesRuntimeConfig = {
    appAdminClient: config.appAdminClient,
    coreReadClient: config.coreReadClient,
    coreWriteClient: config.coreWriteClient,
    executionAuthorityMode: config.executionAuthorityMode ?? 'auto',
    apiBaseUrl: normalizeApiBaseUrl(config.apiBaseUrl),
    userCenter: normalizeUserCenterRuntimeConfig(config.userCenter),
  };
}

export function bindDefaultBirdCoderIdeServicesRuntime(
  options: BindDefaultBirdCoderIdeServicesRuntimeOptions = {},
): void {
  configureDefaultBirdCoderIdeServicesRuntime({
    appAdminClient: options.appAdminClient,
    coreReadClient: options.coreReadClient,
    coreWriteClient: options.coreWriteClient,
    executionAuthorityMode: resolveExecutionAuthorityMode(options),
    apiBaseUrl: resolveBoundApiBaseUrl(options),
    userCenter: normalizeUserCenterRuntimeConfig(options.userCenter),
  });
}

export function syncBirdCoderRuntimeUserCenterBindingFromMetadata(
  metadata?: BirdCoderUserCenterMetadataSummary | null,
): void {
  if (!metadata) {
    return;
  }

  const currentConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  const providerKey = metadata.providerKey?.trim() || undefined;
  const providerKind = resolveBirdCoderRuntimeUserCenterProviderKind(
    metadata.mode,
  );

  configureDefaultBirdCoderIdeServicesRuntime({
    ...currentConfig,
    userCenter: {
      ...(currentConfig.userCenter ?? {}),
      ...(providerKey ? { providerKey } : {}),
      providerKind,
    },
  });
}

export function resetDefaultBirdCoderIdeServicesRuntimeForTests(): void {
  defaultIdeServicesRuntimeConfig = {};
}
