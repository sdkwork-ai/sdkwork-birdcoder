import {
  createSdkworkIamRuntimeAuthController,
  isSdkworkAuthLeftRailMode,
  isSdkworkAuthLoginMethod,
  resolveSdkworkAuthDevelopmentPrefill,
  resolveSdkworkAuthLoginMethods,
  resolveSdkworkAuthOAuthProviderRegion,
  resolveSdkworkAuthOAuthProviders,
  resolveSdkworkAuthRecoveryMethods,
  resolveSdkworkAuthRegisterMethods,
  resolveSdkworkAuthVerificationPolicy,
  type CreateSdkworkIamRuntimeAuthControllerOptions,
  type SdkworkAuthController,
  type SdkworkAuthDevelopmentPrefillConfig,
  type SdkworkAuthLeftRailMode,
  type SdkworkAuthRuntimeConfig,
} from "@sdkwork/auth-pc-react";

const DEFAULT_BIRDCODER_AUTH_LEFT_RAIL_MODE: SdkworkAuthLeftRailMode = "qr-only";
const BIRDCODER_AUTH_METHOD_UNAVAILABLE_MESSAGE =
  "This BirdCoder sign-in method is temporarily unavailable.";

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

function resolveBirdCoderAuthDevelopmentPrefill(): SdkworkAuthDevelopmentPrefillConfig | undefined {
  if (!isBirdCoderDevelopmentRuntime()) {
    return resolveSdkworkAuthDevelopmentPrefill();
  }
  const configuredAccount = readBirdCoderPublicEnvValue(
    "VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT",
    "VITE_SDKWORK_AUTH_DEV_DEFAULT_ACCOUNT",
  );
  const configuredEmail = readBirdCoderPublicEnvValue(
    "VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL",
    "VITE_SDKWORK_AUTH_DEV_DEFAULT_EMAIL",
  );
  const configuredPhone = readBirdCoderPublicEnvValue(
    "VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE",
    "VITE_SDKWORK_AUTH_DEV_DEFAULT_PHONE",
  );
  const configuredPassword = readBirdCoderPublicEnvValue(
    "VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD",
    "VITE_SDKWORK_AUTH_DEV_DEFAULT_PASSWORD",
  );
  const configuredLoginMethod = readBirdCoderPublicEnvValue(
    "VITE_BIRDCODER_AUTH_DEV_DEFAULT_LOGIN_METHOD",
    "VITE_SDKWORK_AUTH_DEV_DEFAULT_LOGIN_METHOD",
  );
  const explicitEnabled = parseBoolean(
    readBirdCoderPublicEnvValue(
      "VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED",
      "VITE_SDKWORK_AUTH_DEV_PREFILL_ENABLED",
    ),
  );
  const shouldEnable = explicitEnabled
    ?? (
      isBirdCoderDevelopmentRuntime()
      && Boolean(
        configuredAccount
        || configuredEmail
        || configuredPhone
        || configuredPassword,
      )
    );

  if (!shouldEnable) {
    return undefined;
  }

  return {
    account: configuredAccount || configuredEmail,
    email: configuredEmail || configuredAccount,
    enabled: true,
    loginMethod:
      (isSdkworkAuthLoginMethod(configuredLoginMethod)
        ? configuredLoginMethod
        : undefined) || (configuredPassword ? "password" : undefined),
    password: configuredPassword,
    phone: configuredPhone,
  };
}

export function resolveBirdCoderAuthRuntimeConfig(): SdkworkAuthRuntimeConfig {
  const developmentPrefill = resolveBirdCoderAuthDevelopmentPrefill();
  const verificationPolicy = resolveSdkworkAuthVerificationPolicy();

  return {
    leftRailMode: resolveBirdCoderAuthLeftRailMode(),
    loginMethods: resolveSdkworkAuthLoginMethods(undefined, verificationPolicy),
    oauthLoginEnabled: true,
    oauthProviderRegion: resolveSdkworkAuthOAuthProviderRegion(),
    oauthProviders: resolveSdkworkAuthOAuthProviders(),
    qrLoginEnabled: true,
    recoveryMethods: resolveSdkworkAuthRecoveryMethods(),
    registerMethods: resolveSdkworkAuthRegisterMethods(),
    verificationPolicy,
    ...(developmentPrefill ? { developmentPrefill } : {}),
  };
}

export interface CreateBirdCoderAuthControllerOptions
  extends Omit<
    CreateSdkworkIamRuntimeAuthControllerOptions,
    "methodUnavailableMessage"
  > {
  methodUnavailableMessage?: string;
}

export function createBirdCoderAuthController(
  options: CreateBirdCoderAuthControllerOptions,
): SdkworkAuthController {
  return createSdkworkIamRuntimeAuthController({
    ...options,
    methodUnavailableMessage:
      options.methodUnavailableMessage ?? BIRDCODER_AUTH_METHOD_UNAVAILABLE_MESSAGE,
  });
}

export type BirdCoderAuthController = ReturnType<typeof createBirdCoderAuthController>;
