import {
  USER_CENTER_SOURCE_PACKAGE_NAME,
  createSdkworkCanonicalUserCenterDefinition,
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
} from '@sdkwork/user-center-core-pc-react';
import {
  BIRDCODER_USER_CENTER_NAMESPACE,
  BIRDCODER_USER_CENTER_ROUTES,
  BIRDCODER_USER_CENTER_STORAGE_PLAN,
  type BirdCoderUserCenterStoragePlan as CoreBirdCoderUserCenterStoragePlan,
  type BirdCoderUserCenterTokenBundle as CoreBirdCoderUserCenterTokenBundle,
} from '@sdkwork/birdcoder-core';

const birdCoderUserCenterDefinition = createSdkworkCanonicalUserCenterDefinition({
  capabilities: ['auth', 'user', 'vip'],
  namespace: BIRDCODER_USER_CENTER_NAMESPACE,
  packageNames: ['@sdkwork/birdcoder-auth', '@sdkwork/birdcoder-user'],
  routes: BIRDCODER_USER_CENTER_ROUTES,
  title: 'BirdCoder User Center',
});

export type BirdCoderUserCenterRuntimeConfig = UserCenterBridgeConfig;
export type BirdCoderUserCenterStoragePlan = CoreBirdCoderUserCenterStoragePlan;
export type BirdCoderUserCenterTokenBundle = CoreBirdCoderUserCenterTokenBundle;
export type BirdCoderUserCenterRoutes = UserCenterRoutes;
export type BirdCoderUserCenterLocalApiRoutes = UserCenterLocalApiRoutes;
export type BirdCoderUserCenterPluginDefinition = UserCenterPluginDefinition;
export type BirdCoderUserCenterServerPluginDefinition = UserCenterServerPluginDefinition;
export type BirdCoderUserCenterPluginCapability = UserCenterPluginCapabilityName;
export type BirdCoderUserCenterServerOperationContract = UserCenterServerOperationContract;
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
export type BirdCoderUserCenterRuntimeRequestMethod = UserCenterRuntimeRequestMethod;

export const BIRDCODER_USER_CENTER_SOURCE_PACKAGE = USER_CENTER_SOURCE_PACKAGE_NAME;
export const BIRDCODER_USER_CENTER_DEFINITION = birdCoderUserCenterDefinition;
export const BIRDCODER_USER_CENTER_PLUGIN_PACKAGES = birdCoderUserCenterDefinition.packageNames;
export const BIRDCODER_USER_CENTER_LOCAL_API = birdCoderUserCenterDefinition.localApiRoutes;

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

export {
  BIRDCODER_USER_CENTER_NAMESPACE,
  BIRDCODER_USER_CENTER_ROUTES,
  BIRDCODER_USER_CENTER_STORAGE_PLAN,
};
