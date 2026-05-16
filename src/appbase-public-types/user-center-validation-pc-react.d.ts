import type {
  SdkworkCanonicalUserCenterDefinition,
  UserCenterBridgeConfig,
  UserCenterPluginDefinition,
  UserCenterServerPluginDefinition,
} from "./user-center-core-pc-react";

export const USER_CENTER_VALIDATION_SOURCE_PACKAGE_NAME:
  "@sdkwork/user-center-validation-pc-react";

export interface UserCenterValidationSnapshot {
  bridgeConfig: UserCenterBridgeConfig;
  packageNames: readonly string[];
  sourcePackageName: typeof USER_CENTER_VALIDATION_SOURCE_PACKAGE_NAME;
  title: string;
}

export interface UserCenterValidationInteropContract {
  snapshot: UserCenterValidationSnapshot;
}

export interface UserCenterValidationPluginDefinition
  extends UserCenterPluginDefinition {
  validation: UserCenterValidationInteropContract;
}

export interface UserCenterServerValidationPluginDefinition
  extends UserCenterServerPluginDefinition {
  validation: UserCenterValidationInteropContract;
}

export interface UserCenterValidationPreflightReport {
  errors: readonly string[];
  ok: boolean;
  warnings: readonly string[];
}

export interface CreateSdkworkCanonicalUserCenterValidationPluginDefinitionOptions {
  packageNames?: readonly string[];
}

export interface CreateSdkworkCanonicalUserCenterServerValidationPluginDefinitionOptions
  extends CreateSdkworkCanonicalUserCenterValidationPluginDefinitionOptions {}

export interface CreateSdkworkCanonicalUserCenterValidationPreflightOptions {
  bridgeConfig?: UserCenterBridgeConfig;
  expectedNamespace?: string;
  strict?: boolean;
}

export interface CreateSdkworkCanonicalUserCenterValidationDefinitionOptions {
  packageNames: readonly string[];
  title: string;
  userCenter: SdkworkCanonicalUserCenterDefinition;
}

export interface SdkworkCanonicalUserCenterValidationDefinition
  extends CreateSdkworkCanonicalUserCenterValidationDefinitionOptions {
  sourcePackageName: typeof USER_CENTER_VALIDATION_SOURCE_PACKAGE_NAME;
  createInteropContract(options?: unknown): UserCenterValidationInteropContract;
  createPluginDefinition(
    options?: CreateSdkworkCanonicalUserCenterValidationPluginDefinitionOptions,
  ): UserCenterValidationPluginDefinition;
  createPreflightReport(
    options: CreateSdkworkCanonicalUserCenterValidationPreflightOptions,
  ): UserCenterValidationPreflightReport;
  createServerPluginDefinition(
    options?: CreateSdkworkCanonicalUserCenterServerValidationPluginDefinitionOptions,
  ): UserCenterServerValidationPluginDefinition;
  createSnapshot(options?: unknown): UserCenterValidationSnapshot;
  assertPreflight(
    options: CreateSdkworkCanonicalUserCenterValidationPreflightOptions,
  ): UserCenterValidationPreflightReport;
}

export declare function createSdkworkCanonicalUserCenterValidationDefinition(
  options: CreateSdkworkCanonicalUserCenterValidationDefinitionOptions,
): SdkworkCanonicalUserCenterValidationDefinition;

export declare function createUserCenterValidationInteropContract(
  snapshot: UserCenterValidationSnapshot,
): UserCenterValidationInteropContract;

export declare function createUserCenterValidationSnapshot(
  bridgeConfig: UserCenterBridgeConfig,
): UserCenterValidationSnapshot;
