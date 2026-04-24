import {
  BIRDCODER_USER_CENTER_LOCAL_API_BASE_PATH,
  BIRDCODER_USER_CENTER_NAMESPACE,
  BIRDCODER_USER_CENTER_ROUTES,
  BIRDCODER_USER_CENTER_STORAGE_PLAN,
  resolveBirdCoderRuntimeUserCenterProviderKind,
  type BirdCoderRuntimeUserCenterProviderKind,
} from "@sdkwork/birdcoder-core";
import {
  createCanonicalUserCenterRuntimeBridge,
  createUserCenterRuntimeClient,
  createUserCenterSessionStore,
  createUserCenterTokenStore,
  type CanonicalUserCenterRuntimeBridge,
  type UserCenterBridgeConfig,
  type UserCenterRuntimeClient,
  type UserCenterRuntimeClientOptions,
  type UserCenterRuntimeConfig,
} from "@sdkwork/user-center-core-pc-react";
import {
  createUserCenterValidationInteropContract,
  createUserCenterValidationSnapshot,
} from "@sdkwork/user-center-validation-pc-react";
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from "./defaultIdeServicesRuntime.ts";

export type BirdCoderRuntimeUserCenterClient = UserCenterRuntimeClient;
export type BirdCoderRuntimeUserCenterConfig = UserCenterRuntimeConfig;
export type BirdCoderCanonicalUserCenterBridgeConfig = UserCenterBridgeConfig;
export type BirdCoderCanonicalUserCenterRuntimeBridge =
  CanonicalUserCenterRuntimeBridge;

export const BIRDCODER_CANONICAL_USER_CENTER_SQLITE_PATH =
  "app://sdkwork-birdcoder/user-center.db";
export const BIRDCODER_CANONICAL_USER_CENTER_DATABASE_KEY =
  "sdkwork-birdcoder-user-center";
export const BIRDCODER_CANONICAL_USER_CENTER_MIGRATION_NAMESPACE =
  "sdkwork-birdcoder.user-center";
export const BIRDCODER_CANONICAL_USER_CENTER_TABLE_PREFIX = "bc_uc_";

interface BirdCoderResolvedRuntimeUserCenterBinding {
  baseUrl?: string;
  providerKey?: string;
  providerKind: BirdCoderRuntimeUserCenterProviderKind;
}

function resolveBirdCoderRuntimeUserCenterBinding():
  | BirdCoderResolvedRuntimeUserCenterBinding
  | null {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  const configuredBaseUrl = runtimeConfig.userCenter?.baseUrl?.trim();
  const apiBaseUrl = runtimeConfig.apiBaseUrl?.trim();
  const baseUrl = configuredBaseUrl || apiBaseUrl;
  const providerKey = runtimeConfig.userCenter?.providerKey?.trim() || undefined;
  const explicitProviderKind = runtimeConfig.userCenter?.providerKind;
  const resolvedProviderKind = resolveBirdCoderRuntimeUserCenterProviderKind(
    explicitProviderKind,
  );

  if (!baseUrl && !providerKey && !explicitProviderKind) {
    return null;
  }

  return {
    ...(baseUrl ? { baseUrl } : {}),
    ...(providerKey ? { providerKey } : {}),
    providerKind:
      baseUrl && resolvedProviderKind !== "external-user-center"
        ? "sdkwork-cloud-app-api"
        : resolvedProviderKind,
  };
}

function resolveBirdCoderRuntimeBridgeProvider(
  binding: BirdCoderResolvedRuntimeUserCenterBinding | null,
) {
  const providerKind =
    binding?.providerKind ?? resolveBirdCoderRuntimeUserCenterProviderKind();

  return {
    ...(binding?.baseUrl ? { baseUrl: binding.baseUrl } : {}),
    kind: providerKind,
    ...(binding?.providerKey ? { providerKey: binding.providerKey } : {}),
  } as const;
}

function resolveBirdCoderExternalRuntimeBinding(
  binding: BirdCoderResolvedRuntimeUserCenterBinding | null,
) {
  if (!binding?.baseUrl) {
    return null;
  }

  if (binding.providerKind === "builtin-local") {
    return null;
  }

  return {
    baseUrl: binding.baseUrl,
    ...(binding.providerKey ? { providerKey: binding.providerKey } : {}),
    providerKind: binding.providerKind,
  } as const;
}

function createBirdCoderRuntimeValidationInteropContract(
  bridgeConfig: BirdCoderCanonicalUserCenterBridgeConfig,
) {
  return createUserCenterValidationInteropContract(
    createUserCenterValidationSnapshot(bridgeConfig),
  );
}

export function createBirdCoderCanonicalUserCenterRuntimeBridge(
  runtimeClientOptions: UserCenterRuntimeClientOptions = {},
): BirdCoderCanonicalUserCenterRuntimeBridge {
  const binding = resolveBirdCoderRuntimeUserCenterBinding();
  const bridge = createCanonicalUserCenterRuntimeBridge({
    localApiBasePath: BIRDCODER_USER_CENTER_LOCAL_API_BASE_PATH,
    namespace: BIRDCODER_USER_CENTER_NAMESPACE,
    provider: resolveBirdCoderRuntimeBridgeProvider(binding),
    resolveRuntimeBinding: resolveBirdCoderExternalRuntimeBinding(binding),
    routes: BIRDCODER_USER_CENTER_ROUTES,
    storage: {
      dialect: "sqlite",
      sqlitePath: BIRDCODER_CANONICAL_USER_CENTER_SQLITE_PATH,
    },
    storageTopology: {
      databaseKey: BIRDCODER_CANONICAL_USER_CENTER_DATABASE_KEY,
      migrationNamespace: BIRDCODER_CANONICAL_USER_CENTER_MIGRATION_NAMESPACE,
      tablePrefix: BIRDCODER_CANONICAL_USER_CENTER_TABLE_PREFIX,
    },
  });
  const resolvedRuntimeClientOptions = {
    ...runtimeClientOptions,
    ...(
      runtimeClientOptions.validationInteropContract
      || runtimeClientOptions.resolveValidationInteropContract
        ? {}
        : {
            validationInteropContract:
              createBirdCoderRuntimeValidationInteropContract(
                bridge.bridgeConfig,
              ),
          }
    ),
  } satisfies UserCenterRuntimeClientOptions;

  return {
    ...bridge,
    runtimeClient: bridge.apiBaseUrl
      ? createUserCenterRuntimeClient(
          bridge.runtimeConfig,
          resolvedRuntimeClientOptions,
        )
      : null,
  };
}

export function resolveBirdCoderRuntimeUserCenterApiBaseUrl(): string | null {
  return createBirdCoderCanonicalUserCenterRuntimeBridge().apiBaseUrl;
}

export function createBirdCoderCanonicalUserCenterBridgeConfig(): BirdCoderCanonicalUserCenterBridgeConfig {
  return createBirdCoderCanonicalUserCenterRuntimeBridge().bridgeConfig;
}

export function createBirdCoderCanonicalUserCenterConfig(): BirdCoderRuntimeUserCenterConfig {
  return createBirdCoderCanonicalUserCenterRuntimeBridge().runtimeConfig;
}

export function createBirdCoderRuntimeUserCenterClient(
  options: UserCenterRuntimeClientOptions = {},
): BirdCoderRuntimeUserCenterClient | null {
  return createBirdCoderCanonicalUserCenterRuntimeBridge(options).runtimeClient;
}

function assertStoragePlanSync(): void {
  const runtimeConfig = createBirdCoderCanonicalUserCenterConfig();
  if (
    runtimeConfig.storagePlan.sessionHeaderName
      !== BIRDCODER_USER_CENTER_STORAGE_PLAN.sessionHeaderName
    || runtimeConfig.storagePlan.sessionTokenKey
      !== BIRDCODER_USER_CENTER_STORAGE_PLAN.sessionTokenKey
  ) {
    throw new Error(
      "BirdCoder user-center runtime bridge is out of sync with the canonical storage plan.",
    );
  }
}

assertStoragePlanSync();

export {
  createUserCenterRuntimeClient,
  createUserCenterSessionStore,
  createUserCenterTokenStore,
};
