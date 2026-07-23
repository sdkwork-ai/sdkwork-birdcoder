import type { BirdHostDescriptor } from '@sdkwork/birdcoder-pc-host-core';
import type { SdkworkDocumentsAppClient } from '@sdkwork/birdcoder-pc-core/sdk/documents-app';
import type { SdkworkPromptsAppClient } from '@sdkwork/birdcoder-pc-core/sdk/prompts-app';
import type { BirdCoderAppSdkApiClient } from './birdCoderSdkClient.ts';
import { normalizeBirdCoderSdkBaseUrl } from './sdkBaseUrls.ts';
import {
  resolveBirdCoderRuntimeTopology,
  type BirdCoderDeploymentProfile,
  type BirdCoderExecutionLocation,
  type BirdCoderRuntimeTarget,
  type BirdCoderRuntimeTopology,
} from './runtimeTopology.ts';

export interface BirdCoderDefaultIdeServicesRuntimeConfig {
  applicationApiBaseUrl?: string;
  appClient?: BirdCoderAppSdkApiClient;
  documentsClient?: SdkworkDocumentsAppClient;
  executionAuthorityMode?: 'auto' | 'remote-required';
  promptsClient?: SdkworkPromptsAppClient;
  platformApiGatewayBaseUrl?: string;
  runtimeTopology?: BirdCoderRuntimeTopology;
}

export interface BindDefaultBirdCoderIdeServicesRuntimeOptions {
  applicationApiBaseUrl?: string;
  appClient?: BirdCoderAppSdkApiClient;
  documentsClient?: SdkworkDocumentsAppClient;
  executionAuthorityMode?: 'auto' | 'remote-required';
  host?: BirdHostDescriptor;
  promptsClient?: SdkworkPromptsAppClient;
  platformApiGatewayBaseUrl?: string;
  deploymentProfile?: BirdCoderDeploymentProfile;
  executionLocation?: BirdCoderExecutionLocation;
  runtimeTarget?: BirdCoderRuntimeTarget;
}

let defaultIdeServicesRuntimeConfig: BirdCoderDefaultIdeServicesRuntimeConfig = {};

function resolveBoundApplicationApiBaseUrl(
  options: BindDefaultBirdCoderIdeServicesRuntimeOptions,
): string | undefined {
  const explicitApiBaseUrl = normalizeBirdCoderSdkBaseUrl(
    options.applicationApiBaseUrl,
    'BirdCoder application SDK base URL',
  );
  if (explicitApiBaseUrl) {
    return explicitApiBaseUrl;
  }

  return normalizeBirdCoderSdkBaseUrl(
    options.host?.apiBaseUrl,
    'BirdCoder host application SDK base URL',
  );
}

function resolveExecutionAuthorityMode(
  options: BindDefaultBirdCoderIdeServicesRuntimeOptions,
): 'auto' | 'remote-required' {
  if (options.executionAuthorityMode) {
    return options.executionAuthorityMode;
  }

  if (
    resolveBoundApplicationApiBaseUrl(options) || options.appClient
  ) {
    return 'remote-required';
  }

  return 'auto';
}

function resolveRuntimeTarget(
  options: BindDefaultBirdCoderIdeServicesRuntimeOptions,
): BirdCoderRuntimeTarget | undefined {
  if (options.runtimeTarget) return options.runtimeTarget;
  if (options.host?.mode === 'desktop') return 'desktop';
  if (options.host?.mode === 'web') return 'browser';
  if (options.host?.mode === 'server') return 'server';
  return undefined;
}

export function getDefaultBirdCoderIdeServicesRuntimeConfig(): BirdCoderDefaultIdeServicesRuntimeConfig {
  return {
    ...defaultIdeServicesRuntimeConfig,
    runtimeTopology: defaultIdeServicesRuntimeConfig.runtimeTopology
      ? { ...defaultIdeServicesRuntimeConfig.runtimeTopology }
      : undefined,
  };
}

export function configureDefaultBirdCoderIdeServicesRuntime(
  config: BirdCoderDefaultIdeServicesRuntimeConfig = {},
): void {
  defaultIdeServicesRuntimeConfig = {
    applicationApiBaseUrl: normalizeBirdCoderSdkBaseUrl(
      config.applicationApiBaseUrl,
      'BirdCoder application SDK base URL',
    ),
    appClient: config.appClient,
    documentsClient: config.documentsClient,
    executionAuthorityMode: config.executionAuthorityMode ?? 'auto',
    promptsClient: config.promptsClient,
    platformApiGatewayBaseUrl: normalizeBirdCoderSdkBaseUrl(
      config.platformApiGatewayBaseUrl,
      'SDKWork platform API gateway base URL',
    ),
    runtimeTopology: config.runtimeTopology
      ? { ...config.runtimeTopology }
      : resolveBirdCoderRuntimeTopology(),
  };
}

export function bindDefaultBirdCoderIdeServicesRuntime(
  options: BindDefaultBirdCoderIdeServicesRuntimeOptions = {},
): void {
  configureDefaultBirdCoderIdeServicesRuntime({
    applicationApiBaseUrl: resolveBoundApplicationApiBaseUrl(options),
    appClient: options.appClient,
    documentsClient: options.documentsClient,
    executionAuthorityMode: resolveExecutionAuthorityMode(options),
    promptsClient: options.promptsClient,
    platformApiGatewayBaseUrl: normalizeBirdCoderSdkBaseUrl(
      options.platformApiGatewayBaseUrl,
      'SDKWork platform API gateway base URL',
    ),
    runtimeTopology: resolveBirdCoderRuntimeTopology({
      deploymentProfile: options.deploymentProfile,
      executionLocation: options.executionLocation,
      runtimeTarget: resolveRuntimeTarget(options),
    }),
  });
}

export function resetDefaultBirdCoderIdeServicesRuntimeForTests(): void {
  defaultIdeServicesRuntimeConfig = {};
}
