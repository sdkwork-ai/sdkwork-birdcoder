import {
  BIRDCODER_USER_CENTER_AUTH_BASE_PATH,
  BIRDCODER_USER_CENTER_NAMESPACE,
  BIRDCODER_USER_CENTER_ROUTES,
  BIRDCODER_USER_CENTER_STORAGE_PLAN,
  inferBirdCoderRuntimeUserCenterProviderKindFromIdentityMode,
  requireBirdCoderProtectedToken,
  resolveBirdCoderIdentityDeploymentModeFromPublicEnv,
  resolveBirdCoderProtectedToken,
  resolveBirdCoderRuntimeUserCenterProviderKind,
  resolveBirdCoderRuntimeUserCenterProviderKindFromPublicEnv,
  type BirdCoderIdentityDeploymentMode,
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
} from "../../sdkwork-birdcoder-infrastructure/src/services/userCenterRuntimeBridge.ts";
import {
  USER_CENTER_SOURCE_PACKAGE_NAME,
  createUserCenterStandardAppRouteProjection,
  createSdkworkCanonicalUserCenterDefinition,
  type CreateUserCenterStandardAppRouteProjectionOptions,
  type CreateSdkworkCanonicalUserCenterConfigOptions,
  type CreateSdkworkCanonicalUserCenterHandshakeSigningMessageOptions,
  type CreateSdkworkCanonicalUserCenterHandshakeVerificationContextOptions,
  type CreateSdkworkCanonicalUserCenterPluginDefinitionOptions,
  type CreateSdkworkCanonicalUserCenterServerPluginDefinitionOptions,
  type CreateSdkworkCanonicalUserCenterSignedHandshakeHeadersOptions,
  type SdkworkCanonicalUserCenterDefinition,
  type UserCenterBridgeConfig,
  type UserCenterHandshakeSignature,
  type UserCenterHandshakeVerificationContext,
  type UserCenterLocalApiRoutes,
  type UserCenterPluginCapabilityName,
  type UserCenterPluginDefinition,
  type UserCenterRoutes,
  type UserCenterRuntimeRequestMethod,
  type UserCenterServerOperationContract,
  type UserCenterServerPluginDefinition,
  type UserCenterStandardAppRouteProjection,
} from "@sdkwork/user-center-core-pc-react";
import {
  USER_CENTER_VALIDATION_SOURCE_PACKAGE_NAME,
  createSdkworkCanonicalUserCenterValidationDefinition,
  type CreateSdkworkCanonicalUserCenterServerValidationPluginDefinitionOptions,
  type CreateSdkworkCanonicalUserCenterValidationPluginDefinitionOptions,
  type CreateSdkworkCanonicalUserCenterValidationPreflightOptions,
  type SdkworkCanonicalUserCenterValidationDefinition,
  type UserCenterServerValidationPluginDefinition,
  type UserCenterValidationInteropContract,
  type UserCenterValidationPluginDefinition,
  type UserCenterValidationPreflightReport,
  type UserCenterValidationSnapshot,
} from "@sdkwork/user-center-validation-pc-react";
import type { ComponentType } from "react";

const birdCoderUserCenterDefinition = createSdkworkCanonicalUserCenterDefinition({
  capabilities: ["auth", "user", "vip"],
  namespace: BIRDCODER_USER_CENTER_NAMESPACE,
  packageNames: ["@sdkwork/birdcoder-auth", "@sdkwork/birdcoder-user"],
  routes: BIRDCODER_USER_CENTER_ROUTES,
  title: "BirdCoder User Center",
});

// Keep this façade-local definition in sync with @sdkwork/birdcoder-user.
// The duplication is intentional so the app integration package can stay acyclic
// while still exposing one canonical identity entrypoint for integrators.
const birdCoderUserCenterValidationDefinition =
  createSdkworkCanonicalUserCenterValidationDefinition({
    packageNames: ["@sdkwork/birdcoder-user"],
    title: "BirdCoder User Center",
    userCenter: birdCoderUserCenterDefinition,
  });

export type BirdCoderUserCenterRuntimeConfig = UserCenterBridgeConfig;
export type BirdCoderUserCenterRoutes = UserCenterRoutes;
export type BirdCoderUserCenterLocalApiRoutes = UserCenterLocalApiRoutes;
export type BirdCoderUserCenterPluginDefinition = UserCenterPluginDefinition;
export type BirdCoderUserCenterServerPluginDefinition = UserCenterServerPluginDefinition;
export type BirdCoderUserCenterPluginCapability = UserCenterPluginCapabilityName;
export type BirdCoderUserCenterServerOperationContract =
  UserCenterServerOperationContract;
export type BirdCoderUserCenterHandshakeSignature = UserCenterHandshakeSignature;
export type BirdCoderUserCenterHandshakeVerificationContext =
  UserCenterHandshakeVerificationContext;
export type BirdCoderUserCenterDefinition = SdkworkCanonicalUserCenterDefinition;
export type CreateBirdCoderUserCenterConfigOptions =
  CreateSdkworkCanonicalUserCenterConfigOptions;
export type CreateBirdCoderUserCenterPluginDefinitionOptions =
  CreateSdkworkCanonicalUserCenterPluginDefinitionOptions;
export type CreateBirdCoderUserCenterServerPluginDefinitionOptions =
  CreateSdkworkCanonicalUserCenterServerPluginDefinitionOptions;
export type CreateBirdCoderUserCenterHandshakeSigningMessageOptions =
  CreateSdkworkCanonicalUserCenterHandshakeSigningMessageOptions;
export type CreateBirdCoderUserCenterSignedHandshakeHeadersOptions =
  CreateSdkworkCanonicalUserCenterSignedHandshakeHeadersOptions;
export type CreateBirdCoderUserCenterHandshakeVerificationContextOptions =
  CreateSdkworkCanonicalUserCenterHandshakeVerificationContextOptions;
export type BirdCoderUserCenterRuntimeRequestMethod =
  UserCenterRuntimeRequestMethod;
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

export type BirdCoderUserCenterValidationDefinition =
  SdkworkCanonicalUserCenterValidationDefinition;
export type BirdCoderUserCenterValidationSnapshot = UserCenterValidationSnapshot;
export type BirdCoderUserCenterValidationInteropContract =
  UserCenterValidationInteropContract;
export type BirdCoderUserCenterValidationPluginDefinition =
  UserCenterValidationPluginDefinition;
export type BirdCoderUserCenterServerValidationPluginDefinition =
  UserCenterServerValidationPluginDefinition;
export type BirdCoderUserCenterValidationPreflightReport =
  UserCenterValidationPreflightReport;
export type CreateBirdCoderUserCenterValidationPluginDefinitionOptions =
  CreateSdkworkCanonicalUserCenterValidationPluginDefinitionOptions;
export type CreateBirdCoderUserCenterServerValidationPluginDefinitionOptions =
  CreateSdkworkCanonicalUserCenterServerValidationPluginDefinitionOptions;
export type CreateBirdCoderUserCenterValidationPreflightOptions =
  CreateSdkworkCanonicalUserCenterValidationPreflightOptions;

export interface BirdCoderIdentityDeploymentProfile {
  identityMode: BirdCoderIdentityDeploymentMode;
  providerKind: BirdCoderRuntimeUserCenterProviderKind;
  usesDedicatedServer: boolean;
  usesEmbeddedLocalAuthority: boolean;
  usesExternalUserCenter: boolean;
  usesLocalUserCenter: boolean;
  usesSharedCloudAuthority: boolean;
}

export interface ResolveBirdCoderIdentityDeploymentProfileOptions {
  identityMode?: BirdCoderIdentityDeploymentMode;
  providerKind?: BirdCoderRuntimeUserCenterProviderKind;
}

export interface BirdCoderIdentityPageLoaders {
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

export interface BirdCoderIdentityIntegrationDefinition {
  deployment: BirdCoderIdentityDeploymentProfile;
  pageLoaders: BirdCoderIdentityPageLoaders;
  routes: typeof BIRDCODER_IDENTITY_ROUTES;
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

export const BIRDCODER_USER_CENTER_SOURCE_PACKAGE =
  USER_CENTER_SOURCE_PACKAGE_NAME;
export const BIRDCODER_USER_CENTER_DEFINITION = birdCoderUserCenterDefinition;
export const BIRDCODER_USER_CENTER_PLUGIN_PACKAGES =
  birdCoderUserCenterDefinition.packageNames;
export const BIRDCODER_USER_CENTER_LOCAL_API =
  birdCoderUserCenterDefinition.localApiRoutes;
export const BIRDCODER_USER_CENTER_VALIDATION_SOURCE_PACKAGE =
  USER_CENTER_VALIDATION_SOURCE_PACKAGE_NAME;
export const BIRDCODER_USER_CENTER_VALIDATION_DEFINITION =
  birdCoderUserCenterValidationDefinition;
export const BIRDCODER_USER_CENTER_VALIDATION_PLUGIN_PACKAGES =
  birdCoderUserCenterValidationDefinition.packageNames;
export const BIRDCODER_IDENTITY_AUTH_DEFAULT_ROUTE =
  `${BIRDCODER_USER_CENTER_AUTH_BASE_PATH}/login`;

export const BIRDCODER_IDENTITY_ROUTES = Object.freeze({
  ...BIRDCODER_USER_CENTER_ROUTES,
  authDefaultRoute: BIRDCODER_IDENTITY_AUTH_DEFAULT_ROUTE,
});

export function createBirdCoderUserCenterConfig(
  options: CreateBirdCoderUserCenterConfigOptions = {},
): BirdCoderUserCenterRuntimeConfig {
  return birdCoderUserCenterDefinition.createConfig(options);
}

export function createBirdCoderUserCenterPluginDefinition(
  options: CreateBirdCoderUserCenterPluginDefinitionOptions = {},
): BirdCoderUserCenterPluginDefinition {
  return birdCoderUserCenterDefinition.createPluginDefinition(options);
}

export function createBirdCoderUserCenterServerPluginDefinition(
  options: CreateBirdCoderUserCenterServerPluginDefinitionOptions = {},
): BirdCoderUserCenterServerPluginDefinition {
  return birdCoderUserCenterDefinition.createServerPluginDefinition(options);
}

export function createBirdCoderUserCenterServerOperations(
  options: CreateBirdCoderUserCenterServerPluginDefinitionOptions = {},
): readonly BirdCoderUserCenterServerOperationContract[] {
  return birdCoderUserCenterDefinition.createServerOperations(options);
}

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

export function createBirdCoderUserCenterHandshakeSigningMessage(
  options: CreateBirdCoderUserCenterHandshakeSigningMessageOptions,
): string {
  return birdCoderUserCenterDefinition.createHandshakeSigningMessage(options);
}

export function createBirdCoderUserCenterSignedHandshakeHeaders(
  options: CreateBirdCoderUserCenterSignedHandshakeHeadersOptions,
): Record<string, string> {
  return birdCoderUserCenterDefinition.createSignedHandshakeHeaders(options);
}

export function createBirdCoderUserCenterHandshakeVerificationContext(
  options: CreateBirdCoderUserCenterHandshakeVerificationContextOptions,
): BirdCoderUserCenterHandshakeVerificationContext {
  return birdCoderUserCenterDefinition.createHandshakeVerificationContext(options);
}

export function createBirdCoderUserCenterValidationSnapshot(
  options: CreateBirdCoderUserCenterConfigOptions = {},
): BirdCoderUserCenterValidationSnapshot {
  return birdCoderUserCenterValidationDefinition.createSnapshot(options);
}

export function createBirdCoderUserCenterValidationInteropContract(
  options: CreateBirdCoderUserCenterConfigOptions = {},
): BirdCoderUserCenterValidationInteropContract {
  return birdCoderUserCenterValidationDefinition.createInteropContract(options);
}

export function createBirdCoderUserCenterValidationPluginDefinition(
  options: CreateBirdCoderUserCenterValidationPluginDefinitionOptions = {},
): BirdCoderUserCenterValidationPluginDefinition {
  return birdCoderUserCenterValidationDefinition.createPluginDefinition(options);
}

export function createBirdCoderUserCenterServerValidationPluginDefinition(
  options: CreateBirdCoderUserCenterServerValidationPluginDefinitionOptions = {},
): BirdCoderUserCenterServerValidationPluginDefinition {
  return birdCoderUserCenterValidationDefinition.createServerPluginDefinition(
    options,
  );
}

export function createBirdCoderUserCenterValidationPreflightReport(
  options: CreateBirdCoderUserCenterValidationPreflightOptions,
): BirdCoderUserCenterValidationPreflightReport {
  return birdCoderUserCenterValidationDefinition.createPreflightReport(options);
}

export function assertBirdCoderUserCenterValidationPreflight(
  options: CreateBirdCoderUserCenterValidationPreflightOptions,
): BirdCoderUserCenterValidationPreflightReport {
  return birdCoderUserCenterValidationDefinition.assertPreflight(options);
}

export function resolveBirdCoderIdentityDeploymentProfile(
  options: ResolveBirdCoderIdentityDeploymentProfileOptions = {},
): BirdCoderIdentityDeploymentProfile {
  const identityMode =
    options.identityMode
    ?? resolveBirdCoderIdentityDeploymentModeFromPublicEnv();
  const providerKind =
    options.providerKind
    ?? resolveBirdCoderRuntimeUserCenterProviderKindFromPublicEnv(
      inferBirdCoderRuntimeUserCenterProviderKindFromIdentityMode(identityMode),
    );

  return {
    identityMode,
    providerKind,
    usesDedicatedServer: identityMode !== "desktop-local",
    usesEmbeddedLocalAuthority:
      identityMode === "desktop-local" && providerKind === "builtin-local",
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

export function createBirdCoderIdentityPageLoaders(): BirdCoderIdentityPageLoaders {
  return Object.freeze({
    loadAuthPage,
    loadUserCenterPage,
    loadVipPage,
  });
}

export function createBirdCoderIdentityIntegrationDefinition(
  options: ResolveBirdCoderIdentityDeploymentProfileOptions = {},
): BirdCoderIdentityIntegrationDefinition {
  return Object.freeze({
    deployment: resolveBirdCoderIdentityDeploymentProfile(options),
    pageLoaders: createBirdCoderIdentityPageLoaders(),
    routes: BIRDCODER_IDENTITY_ROUTES,
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
  BIRDCODER_USER_CENTER_NAMESPACE,
  BIRDCODER_USER_CENTER_ROUTES,
  BIRDCODER_USER_CENTER_STORAGE_PLAN,
  createBirdCoderCanonicalUserCenterBridgeConfig,
  createBirdCoderCanonicalUserCenterConfig,
  createBirdCoderCanonicalUserCenterRuntimeBridge,
  createBirdCoderRuntimeUserCenterClient,
  requireBirdCoderProtectedToken,
  resolveBirdCoderProtectedToken,
  resolveBirdCoderRuntimeUserCenterApiBaseUrl,
};
export {
  inferBirdCoderRuntimeUserCenterProviderKindFromIdentityMode,
  normalizeBirdCoderIdentityDeploymentMode,
  normalizeBirdCoderRuntimeUserCenterProviderKind,
  resolveBirdCoderIdentityDeploymentModeFromPublicEnv,
  resolveBirdCoderRuntimeUserCenterProviderKind,
  resolveBirdCoderRuntimeUserCenterProviderKindFromPublicEnv,
  type BirdCoderIdentityDeploymentMode,
  type BirdCoderProtectedTokenRequirementOptions,
  type BirdCoderProtectedTokenResolutionOptions,
  type BirdCoderRuntimeUserCenterProviderKind,
  type BirdCoderUserCenterStoragePlan,
  type BirdCoderUserCenterTokenBundle,
} from "@sdkwork/birdcoder-core";
