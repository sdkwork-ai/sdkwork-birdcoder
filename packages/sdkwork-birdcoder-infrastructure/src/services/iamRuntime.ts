import {
  createIamRuntime,
  type IamRuntime,
  type IamTokenStore,
} from '@sdkwork/iam-runtime';
import type { IamStoredSession } from '@sdkwork/iam-service';
import type { IamAppSdkClient } from '@sdkwork/iam-sdk-ports';
import type { BirdcoderAppSdkClient } from '@sdkwork/birdcoder-app-sdk';
import {
  APP_SESSION_CHANGE_EVENT_NAME,
  clearStoredAppSessionToken,
  loadStoredAppSessionToken,
  storeAppSessionFromResult,
} from './appSessionToken.ts';
import {
  getBirdCoderGeneratedAppSdkClient,
  getBirdCoderGeneratedBackendSdkClient,
  resetBirdCoderSdkClients,
} from './sdkClients.ts';

let runtime: IamRuntime | null = null;
let sessionChangeListenerRegistered = false;

export function createBirdCoderIamRuntime(): IamRuntime {
  registerBirdCoderIamRuntimeSessionChangeListener();
  return createIamRuntime({
    clients: {
      app: createBirdCoderIamAppClientForSdkworkIamRuntime(
        getBirdCoderGeneratedAppSdkClient(),
      ),
      backend: getBirdCoderGeneratedBackendSdkClient(),
    },
    config: {
      appId: readBirdCoderRuntimeEnv('VITE_SDKWORK_APP_ID') ?? 'sdkwork-birdcoder',
      deploymentMode: readIamDeploymentMode() ?? 'private',
      environment: readIamEnvironment() ?? 'dev',
    },
    tokenStore: createBirdCoderIamTokenStore(),
  });
}

export function createBirdCoderIamAppClientForSdkworkIamRuntime(
  client: BirdcoderAppSdkClient,
): IamAppSdkClient {
  const qrSessions = client.openPlatform.qrAuth.sessions;

  return {
    ...client,
    openPlatform: {
      ...client.openPlatform,
      qrAuth: {
        ...client.openPlatform.qrAuth,
        sessions: {
          ...qrSessions,
          create(body: Record<string, unknown>) {
            return qrSessions.create(
              body as unknown as Parameters<typeof qrSessions.create>[0],
            );
          },
          retrieve(sessionKey: string) {
            return qrSessions.retrieve({ sessionKey });
          },
          scans: {
            ...qrSessions.scans,
            create(sessionKey: string, body: Record<string, unknown> = {}) {
              return qrSessions.scans.create(
                { sessionKey },
                body as Parameters<typeof qrSessions.scans.create>[1],
              );
            },
          },
          passwords: {
            ...qrSessions.passwords,
            create(sessionKey: string, body: Record<string, unknown>) {
              return qrSessions.passwords.create(
                { sessionKey },
                body as unknown as Parameters<typeof qrSessions.passwords.create>[1],
              );
            },
          },
        },
      },
    },
  } as unknown as IamAppSdkClient;
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
