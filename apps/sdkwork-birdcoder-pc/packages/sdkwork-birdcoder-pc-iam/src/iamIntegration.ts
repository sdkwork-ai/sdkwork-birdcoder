import type { ComponentType } from 'react';
import {
  BIRDCODER_AUTH_BASE_PATH,
  BIRDCODER_AUTH_DEFINITION,
  BIRDCODER_AUTH_SESSION_KEY,
  BIRDCODER_AUTH_STORAGE_SCOPE,
  type LoadBirdCoderAuthPageOptions,
} from '@sdkwork/birdcoder-pc-auth';
import {
  clearAppSession,
  createAppSession,
  revokeAppSession,
} from '@sdkwork/birdcoder-pc-infrastructure/services/sessionService';
import { getBirdCoderIamRuntime } from '@sdkwork/birdcoder-pc-infrastructure/services/iamRuntime';
import {
  readBirdCoderRuntimePublicEnv,
  resolveBirdCoderRuntimeTopology,
  type BirdCoderRuntimeTopology,
  type ResolveBirdCoderRuntimeTopologyOptions,
} from '@sdkwork/birdcoder-pc-infrastructure/services/runtimeTopology';

export type BirdCoderIamEnvironment = 'dev' | 'prod' | 'test';

export interface BirdCoderIamRuntimeProfile extends BirdCoderRuntimeTopology {
  environment: BirdCoderIamEnvironment;
}

export interface ResolveBirdCoderIamRuntimeProfileOptions
  extends ResolveBirdCoderRuntimeTopologyOptions {
  environment?: BirdCoderIamEnvironment;
}

export interface BirdCoderIamPageLoaders {
  loadAuthPage: typeof loadAuthPage;
}

interface BirdCoderAuthPageLoaderModule {
  loadAuthPage(options: LoadBirdCoderAuthPageOptions): Promise<{ default: ComponentType<any> }>;
}

export const BIRDCODER_IAM_AUTH_DEFAULT_ROUTE = `${BIRDCODER_AUTH_BASE_PATH}/login`;

export const BIRDCODER_IAM_ROUTES = Object.freeze({
  authBasePath: BIRDCODER_AUTH_BASE_PATH,
  authDefaultRoute: BIRDCODER_IAM_AUTH_DEFAULT_ROUTE,
});

export interface BirdCoderIamIntegrationDefinition {
  authDefinition: typeof BIRDCODER_AUTH_DEFINITION;
  runtime: BirdCoderIamRuntimeProfile;
  pageLoaders: BirdCoderIamPageLoaders;
  routes: typeof BIRDCODER_IAM_ROUTES;
  session: {
    clear: typeof clearAppSession;
    create: typeof createAppSession;
    revoke: typeof revokeAppSession;
    sessionKey: string;
    storageScope: string;
  };
  getRuntime: typeof getBirdCoderIamRuntime;
}

function normalizeEnvironment(value: string | undefined): BirdCoderIamEnvironment | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'production' || normalized === 'prod') {
    return 'prod';
  }
  if (normalized === 'test') {
    return 'test';
  }
  if (normalized === 'development' || normalized === 'dev') {
    return 'dev';
  }
  return undefined;
}

export function resolveBirdCoderIamRuntimeProfile(
  options: ResolveBirdCoderIamRuntimeProfileOptions = {},
): BirdCoderIamRuntimeProfile {
  const topology = resolveBirdCoderRuntimeTopology(options);
  const environment =
    options.environment
    ?? normalizeEnvironment(
      readBirdCoderRuntimePublicEnv('VITE_SDKWORK_ENVIRONMENT')
      ?? readBirdCoderRuntimePublicEnv('MODE')
      ?? readBirdCoderRuntimePublicEnv('SDKWORK_VITE_MODE'),
    )
    ?? 'dev';

  return {
    ...topology,
    environment,
  };
}

export async function loadAuthPage() {
  const module =
    await import('@sdkwork/birdcoder-pc-auth') as unknown as BirdCoderAuthPageLoaderModule;
  return module.loadAuthPage({ getRuntime: getBirdCoderIamRuntime });
}

export function createBirdCoderIamPageLoaders(): BirdCoderIamPageLoaders {
  return Object.freeze({
    loadAuthPage,
  });
}

export function createBirdCoderIamIntegrationDefinition(
  options: ResolveBirdCoderIamRuntimeProfileOptions = {},
): BirdCoderIamIntegrationDefinition {
  return Object.freeze({
    authDefinition: BIRDCODER_AUTH_DEFINITION,
    getRuntime: getBirdCoderIamRuntime,
    pageLoaders: createBirdCoderIamPageLoaders(),
    routes: BIRDCODER_IAM_ROUTES,
    runtime: resolveBirdCoderIamRuntimeProfile(options),
    session: {
      clear: clearAppSession,
      create: createAppSession,
      revoke: revokeAppSession,
      sessionKey: BIRDCODER_AUTH_SESSION_KEY,
      storageScope: BIRDCODER_AUTH_STORAGE_SCOPE,
    },
  });
}
