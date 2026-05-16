import {
  BIRDCODER_USER_CENTER_AUTH_BASE_PATH,
  inferBirdCoderRuntimeUserCenterProviderKindFromIamMode,
  requireBirdCoderProtectedToken,
  resolveBirdCoderIamDeploymentModeFromPublicEnv,
  resolveBirdCoderProtectedToken,
  resolveBirdCoderRuntimeUserCenterProviderKind,
  resolveBirdCoderRuntimeUserCenterProviderKindFromPublicEnv,
  type BirdCoderIamDeploymentMode,
  type BirdCoderProtectedTokenRequirementOptions,
  type BirdCoderProtectedTokenResolutionOptions,
  type BirdCoderRuntimeUserCenterProviderKind,
  type BirdCoderUserCenterStoragePlan,
  type BirdCoderUserCenterTokenBundle,
} from "@sdkwork/birdcoder-core";
import {
  createBirdCoderCanonicalUserCenterBridgeConfig,
  createBirdCoderCanonicalUserCenterConfig,
  createBirdCoderCanonicalUserCenterRuntimeBridge,
  createBirdCoderRuntimeUserCenterClient,
  resolveBirdCoderRuntimeUserCenterApiBaseUrl,
} from "@sdkwork/birdcoder-infrastructure";
import {
  createUserCenterStandardAppRouteProjection,
  type CreateUserCenterStandardAppRouteProjectionOptions,
  type UserCenterStandardAppRouteProjection,
} from "@sdkwork/user-center-core-pc-react";
import {
  BIRDCODER_USER_CENTER_DEFINITION,
  BIRDCODER_USER_CENTER_LOCAL_API,
  BIRDCODER_USER_CENTER_PLUGIN_PACKAGES,
  BIRDCODER_USER_CENTER_ROUTES,
  BIRDCODER_USER_CENTER_SOURCE_PACKAGE,
  BIRDCODER_USER_CENTER_STORAGE_PLAN,
  BIRDCODER_USER_CENTER_VALIDATION_DEFINITION,
  BIRDCODER_USER_CENTER_VALIDATION_PLUGIN_PACKAGES,
  BIRDCODER_USER_CENTER_VALIDATION_SOURCE_PACKAGE,
  assertBirdCoderUserCenterValidationPreflight,
  createBirdCoderUserCenterConfig,
  createBirdCoderUserCenterHandshakeSigningMessage,
  createBirdCoderUserCenterHandshakeVerificationContext,
  createBirdCoderUserCenterPluginDefinition,
  createBirdCoderUserCenterServerOperations,
  createBirdCoderUserCenterServerPluginDefinition,
  createBirdCoderUserCenterServerValidationPluginDefinition,
  createBirdCoderUserCenterSignedHandshakeHeaders,
  createBirdCoderUserCenterValidationInteropContract,
  createBirdCoderUserCenterValidationPluginDefinition,
  createBirdCoderUserCenterValidationPreflightReport,
  createBirdCoderUserCenterValidationSnapshot,
  type BirdCoderUserCenterDefinition,
  type BirdCoderUserCenterHandshakeSignature,
  type BirdCoderUserCenterHandshakeVerificationContext,
  type BirdCoderUserCenterLocalApiRoutes,
  type BirdCoderUserCenterPluginCapability,
  type BirdCoderUserCenterPluginDefinition,
  type BirdCoderUserCenterRoutes,
  type BirdCoderUserCenterRuntimeConfig,
  type BirdCoderUserCenterRuntimeRequestMethod,
  type BirdCoderUserCenterServerOperationContract,
  type BirdCoderUserCenterServerPluginDefinition,
  type BirdCoderUserCenterServerValidationPluginDefinition,
  type BirdCoderUserCenterValidationDefinition,
  type BirdCoderUserCenterValidationInteropContract,
  type BirdCoderUserCenterValidationPluginDefinition,
  type BirdCoderUserCenterValidationPreflightReport,
  type BirdCoderUserCenterValidationSnapshot,
  type CreateBirdCoderUserCenterConfigOptions,
  type CreateBirdCoderUserCenterHandshakeSigningMessageOptions,
  type CreateBirdCoderUserCenterHandshakeVerificationContextOptions,
  type CreateBirdCoderUserCenterPluginDefinitionOptions,
  type CreateBirdCoderUserCenterServerPluginDefinitionOptions,
  type CreateBirdCoderUserCenterServerValidationPluginDefinitionOptions,
  type CreateBirdCoderUserCenterSignedHandshakeHeadersOptions,
  type CreateBirdCoderUserCenterValidationPluginDefinitionOptions,
  type CreateBirdCoderUserCenterValidationPreflightOptions,
} from "@sdkwork/birdcoder-user";
import type { ComponentType } from "react";

export type {
  BirdCoderUserCenterDefinition,
  BirdCoderUserCenterHandshakeSignature,
  BirdCoderUserCenterHandshakeVerificationContext,
  BirdCoderUserCenterLocalApiRoutes,
  BirdCoderUserCenterPluginCapability,
  BirdCoderUserCenterPluginDefinition,
  BirdCoderUserCenterRoutes,
  BirdCoderUserCenterRuntimeConfig,
  BirdCoderUserCenterRuntimeRequestMethod,
  BirdCoderUserCenterServerOperationContract,
  BirdCoderUserCenterServerPluginDefinition,
  CreateBirdCoderUserCenterConfigOptions,
  CreateBirdCoderUserCenterHandshakeSigningMessageOptions,
  CreateBirdCoderUserCenterHandshakeVerificationContextOptions,
  CreateBirdCoderUserCenterPluginDefinitionOptions,
  CreateBirdCoderUserCenterServerPluginDefinitionOptions,
  CreateBirdCoderUserCenterSignedHandshakeHeadersOptions,
};
export type BirdCoderUserCenterAppRouteProjection<
  TProjectedRoute,
  TSurface extends string = "app",
  TAuthMode extends string = "user",
> = UserCenterStandardAppRouteProjection<TProjectedRoute, TSurface, TAuthMode>;
export type CreateBirdCoderUserCenterAppRouteProjectionOptions<
  TProjectedRoute,
  TSurface extends string = "app",
  TAuthMode extends string = "user",
> = CreateUserCenterStandardAppRouteProjectionOptions<
  TProjectedRoute,
  TSurface,
  TAuthMode
>;

export type {
  BirdCoderUserCenterServerValidationPluginDefinition,
  BirdCoderUserCenterValidationDefinition,
  BirdCoderUserCenterValidationInteropContract,
  BirdCoderUserCenterValidationPluginDefinition,
  BirdCoderUserCenterValidationPreflightReport,
  BirdCoderUserCenterValidationSnapshot,
  CreateBirdCoderUserCenterServerValidationPluginDefinitionOptions,
  CreateBirdCoderUserCenterValidationPluginDefinitionOptions,
  CreateBirdCoderUserCenterValidationPreflightOptions,
};

export interface BirdCoderIamDeploymentProfile {
  iamMode: BirdCoderIamDeploymentMode;
  providerKind: BirdCoderRuntimeUserCenterProviderKind;
  usesDedicatedServer: boolean;
  usesEmbeddedLocalAuthority: boolean;
  usesExternalUserCenter: boolean;
  usesLocalUserCenter: boolean;
  usesSharedCloudAuthority: boolean;
}

export interface ResolveBirdCoderIamDeploymentProfileOptions {
  iamMode?: BirdCoderIamDeploymentMode;
  providerKind?: BirdCoderRuntimeUserCenterProviderKind;
}

export interface BirdCoderIamPageLoaders {
  loadAuthPage: typeof loadAuthPage;
  loadUserCenterPage: typeof loadUserCenterPage;
  loadVipPage: typeof loadVipPage;
}

interface BirdCoderAuthPageLoaderModule {
  loadAuthPage(): Promise<{ default: ComponentType<any> }>;
}

interface BirdCoderUserPageLoaderModule {
  loadUserCenterPage(): Promise<{ default: ComponentType<any> }>;
  loadVipPage(): Promise<{ default: ComponentType<any> }>;
}

export interface BirdCoderIamIntegrationDefinition {
  deployment: BirdCoderIamDeploymentProfile;
  pageLoaders: BirdCoderIamPageLoaders;
  routes: typeof BIRDCODER_IAM_ROUTES;
  createRuntimeBridge: typeof createBirdCoderCanonicalUserCenterRuntimeBridge;
  createRuntimeBridgeConfig: typeof createBirdCoderCanonicalUserCenterBridgeConfig;
  createRuntimeConfig: typeof createBirdCoderCanonicalUserCenterConfig;
  createRuntimeClient: typeof createBirdCoderRuntimeUserCenterClient;
  resolveRuntimeApiBaseUrl: typeof resolveBirdCoderRuntimeUserCenterApiBaseUrl;
  createUserCenterPluginDefinition: typeof createBirdCoderUserCenterPluginDefinition;
  createUserCenterServerPluginDefinition: typeof createBirdCoderUserCenterServerPluginDefinition;
  createUserCenterServerOperations: typeof createBirdCoderUserCenterServerOperations;
  createValidationSnapshot: typeof createBirdCoderUserCenterValidationSnapshot;
  createValidationInteropContract: typeof createBirdCoderUserCenterValidationInteropContract;
  createValidationPluginDefinition: typeof createBirdCoderUserCenterValidationPluginDefinition;
  createServerValidationPluginDefinition: typeof createBirdCoderUserCenterServerValidationPluginDefinition;
  createValidationPreflightReport: typeof createBirdCoderUserCenterValidationPreflightReport;
  assertValidationPreflight: typeof assertBirdCoderUserCenterValidationPreflight;
}

export const BIRDCODER_IAM_AUTH_DEFAULT_ROUTE =
  `${BIRDCODER_USER_CENTER_AUTH_BASE_PATH}/login`;

export const BIRDCODER_IAM_ROUTES = Object.freeze({
  ...BIRDCODER_USER_CENTER_ROUTES,
  authDefaultRoute: BIRDCODER_IAM_AUTH_DEFAULT_ROUTE,
});

export function createBirdCoderUserCenterAppRouteProjection<
  TProjectedRoute,
  TSurface extends string = "app",
  TAuthMode extends string = "user",
>(
  options: CreateBirdCoderUserCenterAppRouteProjectionOptions<
    TProjectedRoute,
    TSurface,
    TAuthMode
  >,
  configOptions: CreateBirdCoderUserCenterConfigOptions = {},
): BirdCoderUserCenterAppRouteProjection<TProjectedRoute, TSurface, TAuthMode> {
  return createUserCenterStandardAppRouteProjection(
    createBirdCoderUserCenterConfig(configOptions),
    options,
  );
}

export function resolveBirdCoderIamDeploymentProfile(
  options: ResolveBirdCoderIamDeploymentProfileOptions = {},
): BirdCoderIamDeploymentProfile {
  const iamMode =
    options.iamMode
    ?? resolveBirdCoderIamDeploymentModeFromPublicEnv();
  const providerKind =
    options.providerKind
    ?? resolveBirdCoderRuntimeUserCenterProviderKindFromPublicEnv(
      inferBirdCoderRuntimeUserCenterProviderKindFromIamMode(iamMode),
    );

  return {
    iamMode,
    providerKind,
    usesDedicatedServer: iamMode !== "desktop-local",
    usesEmbeddedLocalAuthority:
      iamMode === "desktop-local" && providerKind === "builtin-local",
    usesExternalUserCenter: providerKind === "external-user-center",
    usesLocalUserCenter: providerKind === "builtin-local",
    usesSharedCloudAuthority: providerKind === "sdkwork-cloud-app-api",
  };
}

export async function loadAuthPage() {
  const module =
    await import("@sdkwork/birdcoder-auth") as unknown as BirdCoderAuthPageLoaderModule;
  return module.loadAuthPage();
}

export async function loadUserCenterPage() {
  const module =
    await import("@sdkwork/birdcoder-user") as unknown as BirdCoderUserPageLoaderModule;
  return module.loadUserCenterPage();
}

export async function loadVipPage() {
  const module =
    await import("@sdkwork/birdcoder-user") as unknown as BirdCoderUserPageLoaderModule;
  return module.loadVipPage();
}

export function createBirdCoderIamPageLoaders(): BirdCoderIamPageLoaders {
  return Object.freeze({
    loadAuthPage,
    loadUserCenterPage,
    loadVipPage,
  });
}

export function createBirdCoderIamIntegrationDefinition(
  options: ResolveBirdCoderIamDeploymentProfileOptions = {},
): BirdCoderIamIntegrationDefinition {
  return Object.freeze({
    deployment: resolveBirdCoderIamDeploymentProfile(options),
    pageLoaders: createBirdCoderIamPageLoaders(),
    routes: BIRDCODER_IAM_ROUTES,
    createRuntimeBridge: createBirdCoderCanonicalUserCenterRuntimeBridge,
    createRuntimeBridgeConfig: createBirdCoderCanonicalUserCenterBridgeConfig,
    createRuntimeConfig: createBirdCoderCanonicalUserCenterConfig,
    createRuntimeClient: createBirdCoderRuntimeUserCenterClient,
    resolveRuntimeApiBaseUrl: resolveBirdCoderRuntimeUserCenterApiBaseUrl,
    createUserCenterPluginDefinition: createBirdCoderUserCenterPluginDefinition,
    createUserCenterServerPluginDefinition:
      createBirdCoderUserCenterServerPluginDefinition,
    createUserCenterServerOperations: createBirdCoderUserCenterServerOperations,
    createValidationSnapshot: createBirdCoderUserCenterValidationSnapshot,
    createValidationInteropContract:
      createBirdCoderUserCenterValidationInteropContract,
    createValidationPluginDefinition:
      createBirdCoderUserCenterValidationPluginDefinition,
    createServerValidationPluginDefinition:
      createBirdCoderUserCenterServerValidationPluginDefinition,
    createValidationPreflightReport:
      createBirdCoderUserCenterValidationPreflightReport,
    assertValidationPreflight: assertBirdCoderUserCenterValidationPreflight,
  });
}

export {
  BIRDCODER_USER_CENTER_DEFINITION,
  BIRDCODER_USER_CENTER_LOCAL_API,
  BIRDCODER_USER_CENTER_PLUGIN_PACKAGES,
  BIRDCODER_USER_CENTER_ROUTES,
  BIRDCODER_USER_CENTER_SOURCE_PACKAGE,
  BIRDCODER_USER_CENTER_STORAGE_PLAN,
  BIRDCODER_USER_CENTER_VALIDATION_DEFINITION,
  BIRDCODER_USER_CENTER_VALIDATION_PLUGIN_PACKAGES,
  BIRDCODER_USER_CENTER_VALIDATION_SOURCE_PACKAGE,
  assertBirdCoderUserCenterValidationPreflight,
  createBirdCoderUserCenterConfig,
  createBirdCoderUserCenterHandshakeSigningMessage,
  createBirdCoderUserCenterHandshakeVerificationContext,
  createBirdCoderUserCenterPluginDefinition,
  createBirdCoderUserCenterServerOperations,
  createBirdCoderUserCenterServerPluginDefinition,
  createBirdCoderUserCenterServerValidationPluginDefinition,
  createBirdCoderUserCenterSignedHandshakeHeaders,
  createBirdCoderUserCenterValidationInteropContract,
  createBirdCoderUserCenterValidationPluginDefinition,
  createBirdCoderUserCenterValidationPreflightReport,
  createBirdCoderUserCenterValidationSnapshot,
};
export {
  createBirdCoderCanonicalUserCenterBridgeConfig,
  createBirdCoderCanonicalUserCenterConfig,
  createBirdCoderCanonicalUserCenterRuntimeBridge,
  createBirdCoderRuntimeUserCenterClient,
  requireBirdCoderProtectedToken,
  resolveBirdCoderProtectedToken,
  resolveBirdCoderRuntimeUserCenterApiBaseUrl,
};
export {
  inferBirdCoderRuntimeUserCenterProviderKindFromIamMode,
  normalizeBirdCoderIamDeploymentMode,
  normalizeBirdCoderRuntimeUserCenterProviderKind,
  resolveBirdCoderIamDeploymentModeFromPublicEnv,
  resolveBirdCoderRuntimeUserCenterProviderKind,
  resolveBirdCoderRuntimeUserCenterProviderKindFromPublicEnv,
  type BirdCoderIamDeploymentMode,
  type BirdCoderProtectedTokenRequirementOptions,
  type BirdCoderProtectedTokenResolutionOptions,
  type BirdCoderRuntimeUserCenterProviderKind,
  type BirdCoderUserCenterStoragePlan,
  type BirdCoderUserCenterTokenBundle,
} from "@sdkwork/birdcoder-core";
