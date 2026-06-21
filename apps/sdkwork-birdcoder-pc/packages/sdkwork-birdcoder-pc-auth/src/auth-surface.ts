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
  type SdkworkAuthAppearanceConfig,
  type SdkworkAuthController,
  type SdkworkAuthDevelopmentPrefillConfig,
  type SdkworkAuthLeftRailMode,
  type SdkworkAuthRuntimeConfig,
} from "@sdkwork/auth-pc-react";

const DEFAULT_BIRDCODER_AUTH_LEFT_RAIL_MODE: SdkworkAuthLeftRailMode = "qr-only";
const BIRDCODER_AUTH_METHOD_UNAVAILABLE_MESSAGE =
  "This BirdCoder sign-in method is temporarily unavailable.";

const BIRDCODER_VERIFICATION_POLICY = {
  emailCodeLoginEnabled: false,
  emailRegistrationVerificationRequired: false,
  phoneCodeLoginEnabled: false,
  phoneRegistrationVerificationRequired: false,
} as const;

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
  const configuredPassword = undefined;
  const configuredVerificationCode = readBirdCoderPublicEnvValue(
    "VITE_BIRDCODER_AUTH_DEV_VERIFICATION_CODE",
    "VITE_SDKWORK_AUTH_DEV_VERIFICATION_CODE",
  );
  const verificationCodePrefillEnabled = parseBoolean(readBirdCoderPublicEnvValue(
    "VITE_BIRDCODER_AUTH_DEV_VERIFICATION_CODE_PREFILL_ENABLED",
    "VITE_SDKWORK_AUTH_DEV_VERIFICATION_CODE_PREFILL_ENABLED",
    "VITE_BIRDCODER_AUTH_DEV_VERIFICATION_CODE_ENABLED",
    "VITE_SDKWORK_AUTH_DEV_VERIFICATION_CODE_ENABLED",
  ));
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
        || configuredPassword
        || configuredVerificationCode
      )
    );

  if (!shouldEnable) {
    return undefined;
  }

  return {
    account: configuredAccount || configuredEmail || configuredPhone,
    email: configuredEmail || configuredAccount,
    enabled: true,
    loginMethod: 'password',
    password: configuredPassword,
    phone: configuredPhone,
    verificationCode: configuredVerificationCode,
    ...(typeof verificationCodePrefillEnabled === 'boolean'
      ? { verificationCodePrefillEnabled }
      : {}),
  };
}

export function resolveBirdCoderAuthRuntimeConfig(): SdkworkAuthRuntimeConfig {
  const developmentPrefill = resolveBirdCoderAuthDevelopmentPrefill();

  return {
    leftRailMode: 'qr-only',
    loginMethods: ['password'],
    oauthLoginEnabled: false,
    oauthProviders: [],
    qrLoginEnabled: true,
    recoveryMethods: [],
    registerMethods: ['email', 'phone'],
    verificationPolicy: BIRDCODER_VERIFICATION_POLICY,
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

export function resolveBirdCoderAuthAppearance(): SdkworkAuthAppearanceConfig {
  return {
    asidePanelClassName: "sdkwork-birdcoder-auth-aside-panel",
    qrFrameClassName: "sdkwork-birdcoder-auth-qr-frame",
    slotProps: {
      background: {
        className: "sdkwork-birdcoder-auth-background",
      },
    },
    theme: {
      asideCardBackgroundColor: "var(--sdkwork-birdcoder-auth-aside-card-bg)",
      asideCardBorderColor: "var(--sdkwork-birdcoder-auth-aside-card-border)",
      asidePanelBackgroundColor: "var(--sdkwork-birdcoder-auth-aside-bg)",
      asidePanelBorderColor: "var(--sdkwork-birdcoder-auth-aside-border)",
      asidePanelColor: "var(--sdkwork-birdcoder-auth-aside-text)",
      badgeBackgroundColor: "var(--sdkwork-birdcoder-auth-aside-badge-bg)",
      badgeTextColor: "var(--sdkwork-birdcoder-auth-aside-badge-text)",
      contentBackgroundColor: "var(--sdkwork-birdcoder-auth-content-bg)",
      contentBorderColor: "var(--sdkwork-birdcoder-auth-content-border)",
      contentTextColor: "var(--sdkwork-birdcoder-auth-content-text)",
      descriptionColor: "var(--sdkwork-birdcoder-auth-muted-text)",
      dividerColor: "var(--sdkwork-birdcoder-auth-divider)",
      fieldBackgroundColor: "var(--sdkwork-birdcoder-auth-field-bg)",
      fieldBorderColor: "var(--sdkwork-birdcoder-auth-field-border)",
      fieldPlaceholderColor: "#9ca3af",
      fieldTextColor: "var(--sdkwork-birdcoder-auth-content-text)",
      formMutedTextColor: "var(--sdkwork-birdcoder-auth-muted-text)",
      iconMutedColor: "var(--sdkwork-birdcoder-auth-muted-text)",
      labelColor: "var(--sdkwork-birdcoder-auth-content-text)",
      pageBackgroundColor: "var(--sdkwork-birdcoder-auth-bg)",
      qrFrameBackgroundColor: "var(--sdkwork-birdcoder-auth-qr-bg)",
      qrFrameBorderColor: "var(--sdkwork-birdcoder-auth-qr-border)",
      shellBackdropFilter: "blur(16px)",
      shellBackgroundColor: "var(--sdkwork-birdcoder-auth-content-bg)",
      shellBorderColor: "var(--sdkwork-birdcoder-auth-content-border)",
      tabActiveBackgroundColor: "var(--sdkwork-birdcoder-auth-tab-active-bg)",
      tabActiveTextColor: "var(--sdkwork-birdcoder-auth-content-text)",
      tabBackgroundColor: "var(--sdkwork-birdcoder-auth-tab-bg)",
      tabInactiveTextColor: "var(--sdkwork-birdcoder-auth-muted-text)",
      titleColor: "var(--sdkwork-birdcoder-auth-content-text)",
    },
  };
}

export type BirdCoderAuthController = ReturnType<typeof createBirdCoderAuthController>;
