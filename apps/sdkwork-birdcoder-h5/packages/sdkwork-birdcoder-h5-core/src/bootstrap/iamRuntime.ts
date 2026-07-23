import {
  createSdkworkAppbasePcAuthRuntime,
  type SdkworkAppbasePcAuthRuntimeComposition,
  type SdkworkAppbasePcAuthRuntimeSdkClient,
} from '@sdkwork/auth-runtime-pc-react/appbasePcAuthRuntime';
import type { IamRuntime } from '@sdkwork/iam-runtime';

import {
  clearBirdCoderSessionRecord,
  readBirdCoderSessionRecord,
  writeBirdCoderSessionRecord,
  type BirdCoderSessionRecord,
} from '../session/birdCoderSessionStorage.ts';
import { createBirdCoderH5AppSdkClient } from '../sdk/appSdkClient.ts';
import {
  getBirdCoderH5AgentsAppClient,
  getBirdCoderH5DriveAppClient,
  resetBirdCoderH5DependencySdkClients,
} from '../sdk/dependencySdkClients.ts';
import {
  resolveBirdCoderH5AppbaseAppApiBaseUrl,
} from './runtimeConfig.ts';
import { getBirdCoderGlobalTokenManager } from './tokenManager.ts';

const APP_ID = 'sdkwork-birdcoder';

let composition: SdkworkAppbasePcAuthRuntimeComposition | null = null;

function resolveDeploymentMode(): 'private' | 'saas' {
  const host = globalThis as typeof globalThis & {
    __SDKWORK_H5_REACT_ENV__?: Record<string, unknown>;
  };
  return host.__SDKWORK_H5_REACT_ENV__?.VITE_SDKWORK_DEPLOYMENT_PROFILE === 'cloud'
    ? 'saas'
    : 'private';
}

function resolveEnvironment(): 'dev' | 'prod' | 'test' {
  if (import.meta.env.PROD) {
    return 'prod';
  }
  return import.meta.env.MODE === 'test' ? 'test' : 'dev';
}

function toPersistedSession(value: Record<string, unknown>): BirdCoderSessionRecord {
  const accessToken = typeof value.accessToken === 'string' ? value.accessToken.trim() : '';
  const authToken = typeof value.authToken === 'string' ? value.authToken.trim() : '';
  if (!accessToken || !authToken) {
    throw new Error('IAM session commit requires dual-token credentials.');
  }
  return {
    accessToken,
    authToken,
    context:
      value.context && typeof value.context === 'object' && !Array.isArray(value.context)
        ? value.context as BirdCoderSessionRecord['context']
        : undefined,
    expiresAt:
      typeof value.expiresAt === 'number' || typeof value.expiresAt === 'string'
        ? value.expiresAt
        : undefined,
    refreshToken: typeof value.refreshToken === 'string' ? value.refreshToken : undefined,
    sessionId: typeof value.sessionId === 'string' ? value.sessionId : undefined,
    storedAt: Date.now(),
    user: value.user,
  };
}

export function createBirdCoderIamRuntimeComposition(): SdkworkAppbasePcAuthRuntimeComposition {
  if (composition) {
    return composition;
  }
  const tokenManager = getBirdCoderGlobalTokenManager();
  const sdkClients: SdkworkAppbasePcAuthRuntimeSdkClient[] = [
    createBirdCoderH5AppSdkClient(),
    getBirdCoderH5AgentsAppClient(),
    getBirdCoderH5DriveAppClient(),
  ];
  composition = createSdkworkAppbasePcAuthRuntime({
    app: {
      appId: APP_ID,
      deploymentMode: resolveDeploymentMode(),
      environment: resolveEnvironment(),
      platform: 'h5',
    },
    baseUrls: {
      appbaseAppApiBaseUrl: resolveBirdCoderH5AppbaseAppApiBaseUrl(),
    },
    sdkClients,
    sessionBridge: {
      clearSession: async () => {
        await clearBirdCoderSessionRecord();
        tokenManager.clearTokens();
      },
      commitSession: async (session) => {
        const persisted = toPersistedSession(session as unknown as Record<string, unknown>);
        await writeBirdCoderSessionRecord(persisted);
        return persisted;
      },
      readSession: readBirdCoderSessionRecord,
    },
    tokenManager,
  });
  return composition;
}

export function createBirdCoderIamRuntime(): IamRuntime {
  return createBirdCoderIamRuntimeComposition().runtime;
}

export function getBirdCoderIamRuntime(): IamRuntime {
  return createBirdCoderIamRuntime();
}

export function resetBirdCoderIamRuntime(): void {
  composition = null;
  resetBirdCoderH5DependencySdkClients();
  getBirdCoderGlobalTokenManager().clearTokens();
}
