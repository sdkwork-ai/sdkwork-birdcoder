import {
  createSdkworkAppbasePcAuthRuntime,
  type SdkworkAppbasePcAuthRuntimeComposition,
  type SdkworkAppbasePcAuthRuntimeSdkClient,
} from '@sdkwork/auth-runtime-pc-react/appbasePcAuthRuntime';
import type { IamRuntime } from '@sdkwork/iam-runtime';
import { createAppbaseAppSdkClient } from '@sdkwork/birdcoder-pc-core/sdk';
import { isBlank } from '@sdkwork/utils/string';
import { BIRDCODER_DEFAULT_LOCAL_API_BASE_URL } from '@sdkwork/birdcoder-pc-host-core';
import { createDriveAppClient, type SdkworkDriveAppClient } from '@sdkwork/drive-app-sdk';
import { createClient as createMessagingAppSdkClient } from '@sdkwork/messaging-app-sdk';
import {
  APP_SESSION_CHANGE_EVENT_NAME,
  clearStoredAppSessionToken,
  loadStoredAppSessionToken,
  storeAppSessionFromResult,
} from './appSessionToken.ts';
import { startBirdCoderAppSessionRefreshLoop } from './appSessionRefresh.ts';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import {
  getBirdCoderGeneratedAppSdkClient,
  getBirdCoderGlobalTokenManager,
  resetBirdCoderSdkClients,
  setBirdCoderSdkTokenManager,
} from './sdkClients.ts';

const BIRDCODER_IAM_RUNTIME_APP_ID = 'sdkwork-birdcoder';

function readIamPlatform(): string {
  const target = (
    readBirdCoderRuntimeEnv('VITE_SDKWORK_RUNTIME_TARGET') ??
    readBirdCoderRuntimeEnv('SDKWORK_RUNTIME_TARGET') ??
    readDefaultRuntimeTargetFromSurfaceEnv()
  )?.trim().toLowerCase();

  if (target === 'h5' || target === 'h5-browser' || target === 'capacitor') {
    return 'h5';
  }
  if (target === 'flutter-mobile' || target === 'mobile') {
    return 'mobile';
  }
  return 'pc';
}

function readDefaultRuntimeTargetFromSurfaceEnv(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const runtimeWindow = window as Window & {
    __SDKWORK_H5_REACT_ENV__?: Record<string, unknown>;
  };

  return runtimeWindow.__SDKWORK_H5_REACT_ENV__ ? 'h5' : undefined;
}

let runtimeComposition: SdkworkAppbasePcAuthRuntimeComposition | null = null;
let driveAppClient: SdkworkDriveAppClient | null = null;
let sessionChangeListenerRegistered = false;

export function createBirdCoderIamRuntime(): IamRuntime {
  return createBirdCoderIamRuntimeComposition().runtime;
}

export function createBirdCoderIamRuntimeComposition(): SdkworkAppbasePcAuthRuntimeComposition {
  registerBirdCoderIamRuntimeSessionChangeListener();

  const tokenManager = getBirdCoderGlobalTokenManager();
  const sdkBaseUrls = resolveBirdCoderRuntimeSdkBaseUrls();
  setBirdCoderSdkTokenManager(tokenManager);

  const birdcoderApp = getBirdCoderGeneratedAppSdkClient({
    apiBaseUrl: sdkBaseUrls.birdcoderAppApiBaseUrl,
    tokenManager,
  });
  const iamPlatform = readIamPlatform();
  const driveApp = createDriveAppClient({
    authMode: 'dual-token',
    baseUrl: sdkBaseUrls.driveAppApiBaseUrl,
    platform: iamPlatform,
    tokenManager,
  });
  driveAppClient = driveApp;
  const messagingApp = createMessagingAppSdkClient({
    authMode: 'dual-token',
    baseUrl: sdkBaseUrls.messagingAppApiBaseUrl,
    platform: iamPlatform,
    tokenManager,
  });

  return createSdkworkAppbasePcAuthRuntime({
    app: {
      appId: BIRDCODER_IAM_RUNTIME_APP_ID,
      deploymentMode: readIamDeploymentMode() ?? 'private',
      environment: readIamEnvironment() ?? 'dev',
      platform: iamPlatform,
    },
    baseUrls: {
      appbaseAppApiBaseUrl: sdkBaseUrls.appbaseAppApiBaseUrl,
    },
    createAppbaseAppClient: () => createAppbaseAppSdkClient({
      authMode: 'dual-token',
      baseUrl: sdkBaseUrls.appbaseAppApiBaseUrl,
      platform: iamPlatform,
      tokenManager,
    }),
    hooks: {
      onSessionChanged: () => {
        resetBirdCoderSdkClients();
      },
    },
    sdkClients: [
      birdcoderApp,
      driveApp,
      messagingApp,
    ] as SdkworkAppbasePcAuthRuntimeSdkClient[],
    sessionBridge: {
      clearSession: clearBirdCoderIamRuntimeSession,
      commitSession: (session) => commitBirdCoderIamRuntimeSession(session),
      readSession: loadStoredAppSessionToken,
    },
    tokenManager,
  });
}

interface BirdCoderRuntimeSdkBaseUrls {
  appbaseAppApiBaseUrl: string;
  birdcoderAppApiBaseUrl: string;
  driveAppApiBaseUrl: string;
  messagingAppApiBaseUrl: string;
}

function resolveBirdCoderRuntimeSdkBaseUrls(): BirdCoderRuntimeSdkBaseUrls {
  return {
    appbaseAppApiBaseUrl: resolveBirdCoderRuntimeSdkBaseUrl([
      'VITE_SDKWORK_APPBASE_APP_API_BASE_URL',
      'VITE_SDKWORK_IAM_APP_API_BASE_URL',
      'VITE_SDKWORK_APP_API_BASE_URL',
    ]),
    birdcoderAppApiBaseUrl: resolveBirdCoderRuntimeSdkBaseUrl([
      'VITE_BIRDCODER_APP_API_BASE_URL',
      'VITE_SDKWORK_BIRDCODER_APP_API_BASE_URL',
      'VITE_SDKWORK_APP_API_BASE_URL',
    ]),
    driveAppApiBaseUrl: resolveBirdCoderRuntimeSdkBaseUrl([
      'VITE_SDKWORK_DRIVE_APP_API_BASE_URL',
      'VITE_SDKWORK_APP_API_BASE_URL',
    ]),
    messagingAppApiBaseUrl: resolveBirdCoderRuntimeSdkBaseUrl([
      'VITE_SDKWORK_MESSAGING_APP_API_BASE_URL',
      'VITE_SDKWORK_APP_API_BASE_URL',
    ]),
  };
}

function resolveBirdCoderRuntimeSdkBaseUrl(envNames: readonly string[]): string {
  for (const envName of envNames) {
    const envValue = readBirdCoderRuntimeEnv(envName);
    if (envValue) {
      return envValue;
    }
  }

  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  return runtimeConfig.apiBaseUrl ?? BIRDCODER_DEFAULT_LOCAL_API_BASE_URL;
}

export function getBirdCoderDriveAppClient(): SdkworkDriveAppClient {
  if (!driveAppClient) {
    createBirdCoderIamRuntimeComposition();
  }
  if (!driveAppClient) {
    throw new Error('BirdCoder Drive app SDK client is unavailable.');
  }
  return driveAppClient;
}

export function getBirdCoderIamRuntime(): IamRuntime {
  registerBirdCoderIamRuntimeSessionChangeListener();
  if (!runtimeComposition) {
    runtimeComposition = createBirdCoderIamRuntimeComposition();
  }
  return runtimeComposition.runtime;
}

export function resetBirdCoderIamRuntime(): void {
  runtimeComposition = null;
  driveAppClient = null;
}

function clearBirdCoderIamRuntimeSession(): void {
  clearStoredAppSessionToken();
  resetBirdCoderSdkClients();
}

function commitBirdCoderIamRuntimeSession(session: unknown): ReturnType<typeof storeAppSessionFromResult> {
  const stored = storeAppSessionFromResult(session);
  resetBirdCoderSdkClients();
  return stored;
}

function registerBirdCoderIamRuntimeSessionChangeListener(): void {
  if (sessionChangeListenerRegistered) {
    return;
  }

  sessionChangeListenerRegistered = true;
  startBirdCoderAppSessionRefreshLoop();
  try {
    globalThis.addEventListener?.(
      APP_SESSION_CHANGE_EVENT_NAME,
      handleBirdCoderIamRuntimeSessionChange,
    );
  } catch {
    // Non-browser runtimes still use the session bridge directly; there is no global event target to bind.
  }
}

function handleBirdCoderIamRuntimeSessionChange(): void {
  resetBirdCoderIamRuntime();
}

export function readBirdCoderRuntimeEnv(name: string): string | undefined {
  const windowValue = readRuntimeEnvFromWindow(name);
  if (windowValue) {
    return windowValue;
  }

  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | boolean | undefined>;
  };
  const value = meta.env?.[name];
  return readNonBlankString(value);
}

function readNonBlankString(value: unknown): string | undefined {
  if (typeof value !== 'string' || isBlank(value)) {
    return undefined;
  }
  return value.trim();
}

function readRuntimeEnvFromWindow(name: string): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const runtimeWindow = window as Window & {
    __SDKWORK_PC_REACT_ENV__?: Record<string, unknown>;
    __SDKWORK_H5_REACT_ENV__?: Record<string, unknown>;
    __BIRDCODER_ENV__?: Record<string, unknown>;
  };
  const value =
    runtimeWindow.__BIRDCODER_ENV__?.[name] ??
    runtimeWindow.__SDKWORK_H5_REACT_ENV__?.[name] ??
    runtimeWindow.__SDKWORK_PC_REACT_ENV__?.[name];
  return readNonBlankString(value);
}

function readIamDeploymentMode(): 'local' | 'private' | 'saas' | undefined {
  const value = (
    readBirdCoderRuntimeEnv('VITE_SDKWORK_DEPLOYMENT_MODE') ??
    readBirdCoderRuntimeEnv('VITE_BIRDCODER_IAM_DEPLOYMENT_MODE')
  )?.trim().toLowerCase();
  return value === 'local' || value === 'private' || value === 'saas' ? value : undefined;
}

function readIamEnvironment(): 'dev' | 'prod' | 'test' | undefined {
  const value = (
    readBirdCoderRuntimeEnv('VITE_SDKWORK_ENVIRONMENT') ??
    readBirdCoderRuntimeEnv('MODE') ??
    readBirdCoderRuntimeEnv('SDKWORK_VITE_MODE')
  )?.trim().toLowerCase();

  if (value === 'production' || value === 'prod') {
    return 'prod';
  }
  if (value === 'test') {
    return 'test';
  }
  if (value === 'development' || value === 'dev') {
    return 'dev';
  }
  return undefined;
}

