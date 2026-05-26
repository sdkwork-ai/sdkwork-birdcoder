import type { ComponentType } from 'react';
import {
  BIRDCODER_AUTH_BASE_PATH,
  BIRDCODER_AUTH_DEFINITION,
  BIRDCODER_AUTH_SESSION_KEY,
  BIRDCODER_AUTH_STORAGE_SCOPE,
  type LoadBirdCoderAuthPageOptions,
} from '@sdkwork/birdcoder-auth';
import {
  clearAppSession,
  createAppSession,
  getBirdCoderIamRuntime,
  revokeAppSession,
} from '@sdkwork/birdcoder-infrastructure';

export type BirdCoderIamDeploymentMode = 'local' | 'private' | 'saas';
export type BirdCoderIamEnvironment = 'dev' | 'prod' | 'test';

export interface BirdCoderIamDeploymentProfile {
  environment: BirdCoderIamEnvironment;
  iamMode: BirdCoderIamDeploymentMode;
  usesDedicatedServer: boolean;
  usesEmbeddedLocalAuthority: boolean;
  usesSharedCloudAuthority: boolean;
}

export interface ResolveBirdCoderIamDeploymentProfileOptions {
  environment?: BirdCoderIamEnvironment;
  iamMode?: BirdCoderIamDeploymentMode;
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
  deployment: BirdCoderIamDeploymentProfile;
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

function readBirdCoderPublicEnvValue(...keys: string[]): string | undefined {
  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | boolean | undefined>;
  };

  for (const key of keys) {
    const value = String(meta.env?.[key] ?? '').trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

function normalizeDeploymentMode(value: string | undefined): BirdCoderIamDeploymentMode | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'local' || normalized === 'private' || normalized === 'saas'
    ? normalized
    : undefined;
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

export function resolveBirdCoderIamDeploymentProfile(
  options: ResolveBirdCoderIamDeploymentProfileOptions = {},
): BirdCoderIamDeploymentProfile {
  const iamMode =
    options.iamMode
    ?? normalizeDeploymentMode(
      readBirdCoderPublicEnvValue(
        'VITE_SDKWORK_DEPLOYMENT_MODE',
        'VITE_BIRDCODER_IAM_DEPLOYMENT_MODE',
      ),
    )
    ?? 'private';
  const environment =
    options.environment
    ?? normalizeEnvironment(
      readBirdCoderPublicEnvValue(
        'VITE_SDKWORK_ENVIRONMENT',
        'MODE',
        'SDKWORK_VITE_MODE',
      ),
    )
    ?? 'dev';

  return {
    environment,
    iamMode,
    usesDedicatedServer: iamMode !== 'local',
    usesEmbeddedLocalAuthority: iamMode === 'local',
    usesSharedCloudAuthority: iamMode === 'saas',
  };
}

export async function loadAuthPage() {
  const module =
    await import('@sdkwork/birdcoder-auth') as unknown as BirdCoderAuthPageLoaderModule;
  return module.loadAuthPage({ getRuntime: getBirdCoderIamRuntime });
}

export function createBirdCoderIamPageLoaders(): BirdCoderIamPageLoaders {
  return Object.freeze({
    loadAuthPage,
  });
}

export function createBirdCoderIamIntegrationDefinition(
  options: ResolveBirdCoderIamDeploymentProfileOptions = {},
): BirdCoderIamIntegrationDefinition {
  return Object.freeze({
    authDefinition: BIRDCODER_AUTH_DEFINITION,
    deployment: resolveBirdCoderIamDeploymentProfile(options),
    getRuntime: getBirdCoderIamRuntime,
    pageLoaders: createBirdCoderIamPageLoaders(),
    routes: BIRDCODER_IAM_ROUTES,
    session: {
      clear: clearAppSession,
      create: createAppSession,
      revoke: revokeAppSession,
      sessionKey: BIRDCODER_AUTH_SESSION_KEY,
      storageScope: BIRDCODER_AUTH_STORAGE_SCOPE,
    },
  });
}
