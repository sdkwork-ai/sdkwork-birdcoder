import type {
  SdkworkAuthAppearanceConfig,
  SdkworkAuthRuntimeConfig,
  SdkworkIamRuntimeAuthRuntimeLike,
} from '@sdkwork/auth-pc-react';
import {
  createSdkworkAppbasePcAuthRuntime,
  type SdkworkAppbasePcAuthRuntimeComposition,
  type SdkworkAppbasePcAuthRuntimeSdkClient,
} from '@sdkwork/auth-runtime-pc-react';
import {
  applyAppSdkSessionTokens,
  clearAppSdkSessionTokens,
  getBirdcoderGlobalTokenManager,
  readAppSdkSessionTokens,
  type BirdCoderSession,
} from './session.ts';

type IamEnvironment = 'dev' | 'prod' | 'test';
type IamDeploymentMode = 'local' | 'private' | 'saas';

const BIRDCODER_VERIFICATION_POLICY = {
  emailCodeLoginEnabled: false,
  emailRegistrationVerificationRequired: false,
  phoneCodeLoginEnabled: false,
  phoneRegistrationVerificationRequired: false,
} as const;

let birdcoderIamRuntimeComposition: SdkworkAppbasePcAuthRuntimeComposition | null = null;

function readEnvValue(...keys: string[]): string | undefined {
  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | boolean | undefined>;
  };

  for (const key of keys) {
    const value = meta.env?.[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (['1', 'on', 'true', 'yes'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return undefined;
}

function resolveIamEnvironment(): IamEnvironment {
  const value = readEnvValue(
    'VITE_SDKWORK_BIRDCODER_IAM_ENVIRONMENT',
    'VITE_SDKWORK_IAM_ENVIRONMENT',
  );
  return value === 'prod' || value === 'production'
    ? 'prod'
    : value === 'test'
      ? 'test'
      : 'dev';
}

function resolveIamDeploymentMode(): IamDeploymentMode {
  const value = readEnvValue(
    'VITE_SDKWORK_BIRDCODER_IAM_DEPLOYMENT_MODE',
    'VITE_SDKWORK_IAM_DEPLOYMENT_MODE',
  );
  return value === 'saas' || value === 'private' || value === 'local'
    ? value
    : 'local';
}

export function resetBirdcoderAuthenticatedSdkClients(): void {
  // Reset all SDK clients that depend on authenticated sessions
  // This is called when the session changes
}

export function clearBirdcoderIamRuntimeSession(): void {
  clearAppSdkSessionTokens();
  resetBirdcoderAuthenticatedSdkClients();
}

function getAuthenticatedSdkClients(): SdkworkAppbasePcAuthRuntimeSdkClient[] {
  return [] as SdkworkAppbasePcAuthRuntimeSdkClient[];
}

function resolveAppbaseAppApiBaseUrl(): string {
  return readEnvValue(
    'VITE_SDKWORK_APPBASE_APP_API_BASE_URL',
    'VITE_SDKWORK_IAM_APP_API_BASE_URL',
    'VITE_SDKWORK_APP_API_BASE_URL',
  ) ?? '';
}

function createBirdcoderIamRuntime(): SdkworkAppbasePcAuthRuntimeComposition {
  return createSdkworkAppbasePcAuthRuntime({
    app: {
      appId: 'sdkwork-birdcoder-pc',
      deploymentMode: resolveIamDeploymentMode(),
      environment: resolveIamEnvironment(),
      platform: 'pc',
    },
    baseUrls: {
      appbaseAppApiBaseUrl: resolveAppbaseAppApiBaseUrl(),
    },
    hooks: {
      onSessionChanged: () => {
        resetBirdcoderAuthenticatedSdkClients();
      },
    },
    sdkClients: getAuthenticatedSdkClients(),
    sessionBridge: {
      clearSession: clearBirdcoderIamRuntimeSession,
      commitSession: (session) => applyAppSdkSessionTokens(session as BirdCoderSession),
      readSession: readAppSdkSessionTokens,
    },
    tokenManager: getBirdcoderGlobalTokenManager(),
  });
}

function resolveDevelopmentPrefill(): SdkworkAuthRuntimeConfig['developmentPrefill'] {
  const account = readEnvValue(
    'VITE_SDKWORK_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT',
    'VITE_SDKWORK_AUTH_DEV_DEFAULT_ACCOUNT',
  );
  const email = readEnvValue(
    'VITE_SDKWORK_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL',
    'VITE_SDKWORK_AUTH_DEV_DEFAULT_EMAIL',
  );
  const phone = readEnvValue(
    'VITE_SDKWORK_BIRDCODER_AUTH_DEV_DEFAULT_PHONE',
    'VITE_SDKWORK_AUTH_DEV_DEFAULT_PHONE',
  );
  const password = readEnvValue(
    'VITE_SDKWORK_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD',
    'VITE_SDKWORK_AUTH_DEV_DEFAULT_PASSWORD',
  );
  const verificationCode = readEnvValue(
    'VITE_SDKWORK_BIRDCODER_AUTH_DEV_VERIFICATION_CODE',
    'VITE_SDKWORK_AUTH_DEV_VERIFICATION_CODE',
  );
  const verificationCodePrefillEnabled = parseBoolean(readEnvValue(
    'VITE_SDKWORK_BIRDCODER_AUTH_DEV_VERIFICATION_CODE_PREFILL_ENABLED',
    'VITE_SDKWORK_AUTH_DEV_VERIFICATION_CODE_PREFILL_ENABLED',
    'VITE_SDKWORK_BIRDCODER_AUTH_DEV_VERIFICATION_CODE_ENABLED',
    'VITE_SDKWORK_AUTH_DEV_VERIFICATION_CODE_ENABLED',
  ));
  const enabled = parseBoolean(readEnvValue(
    'VITE_SDKWORK_BIRDCODER_AUTH_DEV_PREFILL_ENABLED',
    'VITE_SDKWORK_AUTH_DEV_PREFILL_ENABLED',
  ));
  const shouldEnable = enabled ?? Boolean(account || email || phone || password || verificationCode);

  if (!shouldEnable) {
    return undefined;
  }

  return {
    account: account || email || phone,
    email,
    enabled: true,
    loginMethod: 'password',
    password,
    phone,
    verificationCode,
    ...(typeof verificationCodePrefillEnabled === 'boolean'
      ? { verificationCodePrefillEnabled }
      : {}),
  };
}

export function getBirdcoderIamRuntime(): SdkworkIamRuntimeAuthRuntimeLike {
  if (!birdcoderIamRuntimeComposition) {
    birdcoderIamRuntimeComposition = createBirdcoderIamRuntime();
  }

  return birdcoderIamRuntimeComposition.runtime as SdkworkIamRuntimeAuthRuntimeLike;
}

export function resetBirdcoderIamRuntime(): void {
  birdcoderIamRuntimeComposition = null;
}

export function resolveBirdcoderAuthRuntimeConfig(): SdkworkAuthRuntimeConfig {
  const developmentPrefill = resolveDevelopmentPrefill();
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

export function resolveBirdcoderAuthAppearance(): SdkworkAuthAppearanceConfig {
  return {
    asidePanelClassName: 'sdkwork-birdcoder-auth-aside-panel',
    bodyClassName: 'sdkwork-birdcoder-auth-body',
    contentContainerClassName: 'sdkwork-birdcoder-auth-content',
    pageClassName: 'sdkwork-birdcoder-auth-page',
    qrFrameClassName: 'sdkwork-birdcoder-auth-qr-frame',
    shellClassName: 'sdkwork-birdcoder-auth-card-shell',
    slotProps: {
      background: {
        className: 'sdkwork-birdcoder-auth-background',
      },
      page: {
        className: 'sdkwork-birdcoder-auth-page',
      },
      shell: {
        className: 'sdkwork-birdcoder-auth-card-shell',
      },
    },
    theme: {
      asideCardBackgroundColor: 'var(--sdkwork-birdcoder-auth-aside-card-bg)',
      asideCardBorderColor: 'var(--sdkwork-birdcoder-auth-aside-card-border)',
      asidePanelBackgroundColor: 'var(--sdkwork-birdcoder-auth-aside-bg)',
      asidePanelBorderColor: 'var(--sdkwork-birdcoder-auth-aside-border)',
      asidePanelColor: 'var(--sdkwork-birdcoder-auth-aside-text)',
      badgeBackgroundColor: 'var(--sdkwork-birdcoder-auth-aside-badge-bg)',
      badgeTextColor: 'var(--sdkwork-birdcoder-auth-aside-badge-text)',
      contentBackgroundColor: 'var(--sdkwork-birdcoder-auth-content-bg)',
      contentBorderColor: 'var(--sdkwork-birdcoder-auth-content-border)',
      contentTextColor: 'var(--sdkwork-birdcoder-auth-content-text)',
      descriptionColor: 'var(--sdkwork-birdcoder-auth-muted-text)',
      dividerColor: 'var(--sdkwork-birdcoder-auth-divider)',
      fieldBackgroundColor: 'var(--sdkwork-birdcoder-auth-field-bg)',
      fieldBorderColor: 'var(--sdkwork-birdcoder-auth-field-border)',
      fieldPlaceholderColor: '#9ca3af',
      fieldTextColor: 'var(--sdkwork-birdcoder-auth-content-text)',
      formMutedTextColor: 'var(--sdkwork-birdcoder-auth-muted-text)',
      iconMutedColor: 'var(--sdkwork-birdcoder-auth-muted-text)',
      labelColor: 'var(--sdkwork-birdcoder-auth-content-text)',
      pageBackgroundColor: 'var(--sdkwork-birdcoder-auth-bg)',
      qrFrameBackgroundColor: 'var(--sdkwork-birdcoder-auth-qr-bg)',
      qrFrameBorderColor: 'var(--sdkwork-birdcoder-auth-qr-border)',
      shellBackdropFilter: 'blur(16px)',
      shellBackgroundColor: 'var(--sdkwork-birdcoder-auth-content-bg)',
      shellBorderColor: 'var(--sdkwork-birdcoder-auth-content-border)',
      tabActiveBackgroundColor: 'var(--sdkwork-birdcoder-auth-tab-active-bg)',
      tabActiveTextColor: 'var(--sdkwork-birdcoder-auth-content-text)',
      tabBackgroundColor: 'var(--sdkwork-birdcoder-auth-tab-bg)',
      tabInactiveTextColor: 'var(--sdkwork-birdcoder-auth-muted-text)',
      titleColor: 'var(--sdkwork-birdcoder-auth-content-text)',
    },
  };
}

// Re-export with the names expected by AuthGate.tsx
export const resolveBirdCoderAuthAppearance = resolveBirdcoderAuthAppearance;
export const resolveBirdCoderAuthRuntimeConfig = resolveBirdcoderAuthRuntimeConfig;
export const getBirdCoderIamRuntime = getBirdcoderIamRuntime;
