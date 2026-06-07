import {
  createIamRuntime,
  type IamRuntime,
  type IamTokenStore,
} from '@sdkwork/iam-runtime';
import type { IamStoredSession } from '@sdkwork/iam-service';
import { createClient as createAppbaseAppSdkClient } from '@sdkwork/appbase-app-sdk';
import { createClient as createAppbaseBackendSdkClient } from '@sdkwork/appbase-backend-sdk';
import { BIRDCODER_DEFAULT_LOCAL_API_BASE_URL } from '@sdkwork/birdcoder-host-core';
import { createDriveAppClient } from '@sdkwork/drive-app-sdk';
import { createIamSdkAdapters } from '@sdkwork/iam-sdk-adapter';
import { createClient as createMessagingAppSdkClient } from '@sdkwork/messaging-app-sdk';
import { createTokenManager } from '@sdkwork/sdk-common';
import {
  APP_SESSION_CHANGE_EVENT_NAME,
  clearStoredAppSessionToken,
  loadStoredAppSessionToken,
  storeAppSessionFromResult,
} from './appSessionToken.ts';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import {
  getBirdCoderGeneratedAppSdkClient,
  getBirdCoderGeneratedBackendSdkClient,
  resetBirdCoderSdkClients,
  setBirdCoderSdkTokenManager,
} from './sdkClients.ts';

let runtime: IamRuntime | null = null;
let sessionChangeListenerRegistered = false;

export function createBirdCoderIamRuntime(): IamRuntime {
  registerBirdCoderIamRuntimeSessionChangeListener();
  const tokenManager = createTokenManager();
  const tokenStore = createBirdCoderIamTokenStore();
  const sdkBaseUrls = resolveBirdCoderRuntimeSdkBaseUrls();
  setBirdCoderSdkTokenManager(tokenManager);

  const rawAppbaseApp = createAppbaseAppSdkClient({
    baseUrl: sdkBaseUrls.appbaseAppApiBaseUrl,
    tokenManager,
  });
  const rawAppbaseBackend = createAppbaseBackendSdkClient({
    baseUrl: sdkBaseUrls.appbaseBackendApiBaseUrl,
    tokenManager,
  });
  const { appbaseApp, appbaseBackend } = createIamSdkAdapters({
    appbaseApp: rawAppbaseApp,
    appbaseBackend: rawAppbaseBackend,
  });
  const birdcoderApp = getBirdCoderGeneratedAppSdkClient({
    apiBaseUrl: sdkBaseUrls.birdcoderAppApiBaseUrl,
    tokenManager,
  });
  const birdcoderBackend = getBirdCoderGeneratedBackendSdkClient({
    apiBaseUrl: sdkBaseUrls.birdcoderBackendApiBaseUrl,
    tokenManager,
  });
  const driveApp = createDriveAppClient({
    baseUrl: sdkBaseUrls.driveAppApiBaseUrl,
    tokenManager,
  });
  const messagingApp = createMessagingAppSdkClient({
    baseUrl: sdkBaseUrls.messagingAppApiBaseUrl,
    tokenManager,
  });

  return createIamRuntime({
    clients: {
      appbaseApp,
      appbaseBackend,
      sdkClients: [
        birdcoderApp,
        birdcoderBackend,
        driveApp,
        messagingApp,
      ],
    },
    config: {
      appId: readBirdCoderRuntimeEnv('VITE_SDKWORK_APP_ID') ?? 'sdkwork-birdcoder',
      appApiBaseUrl: sdkBaseUrls.appbaseAppApiBaseUrl,
      backendApiBaseUrl: sdkBaseUrls.appbaseBackendApiBaseUrl,
      deploymentMode: readIamDeploymentMode() ?? 'private',
      environment: readIamEnvironment() ?? 'dev',
    },
    tokenManager,
    tokenStore,
  });
}

interface BirdCoderRuntimeSdkBaseUrls {
  appbaseAppApiBaseUrl: string;
  appbaseBackendApiBaseUrl: string;
  birdcoderAppApiBaseUrl: string;
  birdcoderBackendApiBaseUrl: string;
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
    appbaseBackendApiBaseUrl: resolveBirdCoderRuntimeSdkBaseUrl([
      'VITE_SDKWORK_APPBASE_BACKEND_API_BASE_URL',
      'VITE_SDKWORK_IAM_BACKEND_API_BASE_URL',
      'VITE_SDKWORK_BACKEND_API_BASE_URL',
    ]),
    birdcoderAppApiBaseUrl: resolveBirdCoderRuntimeSdkBaseUrl([
      'VITE_BIRDCODER_APP_API_BASE_URL',
      'VITE_SDKWORK_BIRDCODER_APP_API_BASE_URL',
      'VITE_SDKWORK_APP_API_BASE_URL',
    ]),
    birdcoderBackendApiBaseUrl: resolveBirdCoderRuntimeSdkBaseUrl([
      'VITE_BIRDCODER_BACKEND_API_BASE_URL',
      'VITE_SDKWORK_BIRDCODER_BACKEND_API_BASE_URL',
      'VITE_SDKWORK_BACKEND_API_BASE_URL',
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

export function getBirdCoderIamRuntime(): IamRuntime {
  registerBirdCoderIamRuntimeSessionChangeListener();
  if (!runtime) {
    runtime = createBirdCoderIamRuntime();
  }
  return runtime;
}

export function resetBirdCoderIamRuntime(): void {
  runtime = null;
}

function registerBirdCoderIamRuntimeSessionChangeListener(): void {
  if (sessionChangeListenerRegistered) {
    return;
  }

  sessionChangeListenerRegistered = true;
  try {
    globalThis.addEventListener?.(
      APP_SESSION_CHANGE_EVENT_NAME,
      handleBirdCoderIamRuntimeSessionChange,
    );
  } catch {
    // Non-browser runtimes still use the token store directly; there is no global event target to bind.
  }
}

function handleBirdCoderIamRuntimeSessionChange(): void {
  resetBirdCoderIamRuntime();
}

export function createBirdCoderIamTokenStore(): IamTokenStore {
  return {
    clear: () => {
      clearStoredAppSessionToken();
      resetBirdCoderSdkClients();
    },
    get: (): IamStoredSession => {
      const stored = loadStoredAppSessionToken();
      return stored
        ? {
            accessToken: stored.accessToken,
            authToken: stored.authToken,
            refreshToken: stored.refreshToken,
          }
        : {};
    },
    set: (session: IamStoredSession) => {
      storeAppSessionFromResult(session);
      resetBirdCoderSdkClients();
    },
  };
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
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readRuntimeEnvFromWindow(name: string): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const runtimeWindow = window as Window & {
    __SDKWORK_PC_REACT_ENV__?: Record<string, unknown>;
    __BIRDCODER_ENV__?: Record<string, unknown>;
  };
  const value =
    runtimeWindow.__BIRDCODER_ENV__?.[name] ??
    runtimeWindow.__SDKWORK_PC_REACT_ENV__?.[name];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
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
