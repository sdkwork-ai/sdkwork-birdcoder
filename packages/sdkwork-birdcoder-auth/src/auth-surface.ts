import {
  createSdkworkAuthUserFromCanonicalIdentity,
  createSdkworkCanonicalAuthController,
  createSdkworkSyntheticAuthSession,
  isSdkworkAuthLeftRailMode,
  isSdkworkAuthLoginMethod,
  resolveSdkworkAuthRuntimeConfigFromMetadata,
  type CreateSdkworkCanonicalAuthControllerOptions,
  type SdkworkAuthController,
  type SdkworkAuthDevelopmentPrefillConfig,
  type SdkworkAuthLeftRailMode,
  type SdkworkAuthRuntimeConfig,
  type SdkworkAuthSession,
  type SdkworkAuthUser,
} from "@sdkwork/auth-pc-react";
import type {
  BirdCoderUserCenterMetadataSummary,
  User,
} from "@sdkwork/birdcoder-types";
import {
  resolveBirdCoderRuntimeUserCenterProviderKind,
} from "@sdkwork/birdcoder-core";

const DEFAULT_BIRDCODER_LOCAL_DEV_ACCOUNT = "local-default@sdkwork-birdcoder.local";
const DEFAULT_BIRDCODER_LOCAL_DEV_PASSWORD = "dev123456";
const DEFAULT_BIRDCODER_AUTH_LEFT_RAIL_MODE: SdkworkAuthLeftRailMode = "qr-only";

function readBirdCoderPublicEnvValue(...keys: string[]): string | undefined {
  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | boolean | undefined>;
  };

  for (const key of keys) {
    const value = String(meta.env?.[key] ?? "").trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (["1", "on", "true", "yes"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function isBirdCoderDevelopmentRuntime(): boolean {
  const currentMode = (readBirdCoderPublicEnvValue("MODE", "SDKWORK_VITE_MODE") || "")
    .trim()
    .toLowerCase();
  return currentMode === "development" || currentMode === "test";
}

function resolveBirdCoderAuthLeftRailMode(): SdkworkAuthLeftRailMode {
  const configuredValue = readBirdCoderPublicEnvValue(
    "VITE_BIRDCODER_AUTH_LEFT_RAIL_MODE",
  );
  return isSdkworkAuthLeftRailMode(configuredValue)
    ? configuredValue
    : DEFAULT_BIRDCODER_AUTH_LEFT_RAIL_MODE;
}

function resolveBirdCoderAuthDevelopmentPrefill(
  authConfig?: BirdCoderUserCenterMetadataSummary | null,
): SdkworkAuthDevelopmentPrefillConfig | undefined {
  const configuredAccount = readBirdCoderPublicEnvValue(
    "VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT",
  );
  const configuredEmail = readBirdCoderPublicEnvValue(
    "VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL",
  );
  const configuredPhone = readBirdCoderPublicEnvValue(
    "VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE",
  );
  const configuredPassword = readBirdCoderPublicEnvValue(
    "VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD",
  );
  const configuredLoginMethod = readBirdCoderPublicEnvValue(
    "VITE_BIRDCODER_AUTH_DEV_DEFAULT_LOGIN_METHOD",
  );
  const explicitEnabled = parseBoolean(
    readBirdCoderPublicEnvValue("VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED"),
  );
  const resolvedProviderKind = resolveBirdCoderRuntimeUserCenterProviderKind(
    authConfig?.mode,
  );
  const isBuiltinLocalMode = resolvedProviderKind === "builtin-local";
  const shouldEnable = explicitEnabled
    ?? (
      isBirdCoderDevelopmentRuntime()
      && (
        isBuiltinLocalMode
        || Boolean(
          configuredAccount
          || configuredEmail
          || configuredPhone
          || configuredPassword,
        )
      )
    );

  if (!shouldEnable) {
    return undefined;
  }

  return {
    account:
      configuredAccount
      || (
        isBuiltinLocalMode
          ? DEFAULT_BIRDCODER_LOCAL_DEV_ACCOUNT
          : undefined
      ),
    email: configuredEmail,
    enabled: true,
    loginMethod:
      (
        isSdkworkAuthLoginMethod(configuredLoginMethod)
          ? configuredLoginMethod
          : undefined
      )
      || (
        isBuiltinLocalMode
          ? "password"
          : undefined
      ),
    password:
      configuredPassword
      || (
        isBuiltinLocalMode
          ? DEFAULT_BIRDCODER_LOCAL_DEV_PASSWORD
          : undefined
      ),
    phone: configuredPhone,
  };
}

export function mapBirdCoderAuthUser(user: User): SdkworkAuthUser {
  return createSdkworkAuthUserFromCanonicalIdentity({
    avatarUrl: user.avatarUrl,
    email: user.email.trim(),
    id: user.id || user.email.trim(),
    name: user.name?.trim() || user.email.trim(),
    username: user.email.trim(),
  });
}

export function createBirdCoderAuthSession(user: User): SdkworkAuthSession {
  return createSdkworkSyntheticAuthSession(mapBirdCoderAuthUser(user), {
    sessionKey: `birdcoder:${user.id || user.email.trim()}`,
  });
}

export function resolveBirdCoderAuthRuntimeConfig(
  authConfig?: BirdCoderUserCenterMetadataSummary | null,
): SdkworkAuthRuntimeConfig {
  const developmentPrefill = resolveBirdCoderAuthDevelopmentPrefill(authConfig);

  return {
    leftRailMode: resolveBirdCoderAuthLeftRailMode(),
    ...resolveSdkworkAuthRuntimeConfigFromMetadata(authConfig),
    ...(developmentPrefill ? { developmentPrefill } : {}),
  };
}

export interface CreateBirdCoderAuthControllerOptions
  extends Omit<
    CreateSdkworkCanonicalAuthControllerOptions<User, BirdCoderUserCenterMetadataSummary>,
    | "resolveSessionBridgeProviderKey"
    | "resolveSyntheticSessionKey"
    | "toSession"
    | "toUser"
  > {}

export function createBirdCoderAuthController(
  options: CreateBirdCoderAuthControllerOptions,
): SdkworkAuthController {
  return createSdkworkCanonicalAuthController({
    ...options,
    resolveSessionBridgeProviderKey(authConfig) {
      return authConfig?.providerKey?.trim() || undefined;
    },
    resolveSyntheticSessionKey(user) {
      return `birdcoder:${user.id || user.email.trim()}`;
    },
    toSession: createBirdCoderAuthSession,
    toUser: mapBirdCoderAuthUser,
  });
}
