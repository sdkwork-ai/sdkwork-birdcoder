import {
  createSdkworkCanonicalAuthDefinition,
  type CreateSdkworkCanonicalAuthDefinitionRouteIntentOptions,
  type CreateSdkworkCanonicalAuthDefinitionWorkspaceManifestOptions,
  type SdkworkAuthRouteId,
  type SdkworkCanonicalAuthDefinition,
  type SdkworkCanonicalAuthRouteDefinition,
  type SdkworkCanonicalAuthRouteIntent,
  type SdkworkCanonicalAuthWorkspaceManifest,
} from '@sdkwork/auth-pc-react';
import {
  BIRDCODER_USER_CENTER_AUTH_BASE_PATH,
  BIRDCODER_USER_CENTER_STORAGE_PLAN,
} from '@sdkwork/birdcoder-core';

export type BirdCoderAuthRouteId = SdkworkAuthRouteId;
export type BirdCoderAuthRouteDefinition =
  SdkworkCanonicalAuthRouteDefinition<'@sdkwork/auth-pc-react'>;
export type BirdCoderAuthRouteIntent = SdkworkCanonicalAuthRouteIntent<'@sdkwork/auth-pc-react'>;
export type BirdCoderAuthWorkspaceManifest = SdkworkCanonicalAuthWorkspaceManifest<
  'birdcoder-auth',
  '@sdkwork/birdcoder-auth',
  '@sdkwork/auth-pc-react'
>;
export type BirdCoderAuthDefinition = SdkworkCanonicalAuthDefinition<
  'birdcoder-auth',
  '@sdkwork/birdcoder-auth',
  '@sdkwork/auth-pc-react'
>;
export type CreateBirdCoderAuthWorkspaceManifestOptions =
  CreateSdkworkCanonicalAuthDefinitionWorkspaceManifestOptions;
export type CreateBirdCoderAuthRouteIntentOptions =
  CreateSdkworkCanonicalAuthDefinitionRouteIntentOptions<'@sdkwork/auth-pc-react'>;

const birdCoderAuthDefinition = createSdkworkCanonicalAuthDefinition({
  architecture: 'birdcoder-auth',
  basePath: BIRDCODER_USER_CENTER_AUTH_BASE_PATH,
  bridgePackageName: '@sdkwork/birdcoder-auth',
  description:
    'BirdCoder auth workspace aligned to sdkwork-appbase login, recovery, OAuth callback, and QR-entry standards.',
  host: 'tauri',
  id: 'sdkwork-birdcoder-auth',
  packageNames: ['@sdkwork/birdcoder-auth'],
  sourcePackageName: '@sdkwork/auth-pc-react',
  title: 'Auth',
});

export const BIRDCODER_AUTH_DEFINITION = birdCoderAuthDefinition;
export const BIRDCODER_AUTH_SOURCE_PACKAGE = birdCoderAuthDefinition.sourcePackageName;
export const BIRDCODER_AUTH_STORAGE_SCOPE = BIRDCODER_USER_CENTER_STORAGE_PLAN.storageScope;
export const BIRDCODER_AUTH_SESSION_KEY = BIRDCODER_USER_CENTER_STORAGE_PLAN.sessionTokenKey;

export function createBirdCoderAuthRouteCatalog(
  basePath: string = BIRDCODER_USER_CENTER_AUTH_BASE_PATH,
): BirdCoderAuthRouteDefinition[] {
  return birdCoderAuthDefinition.createRouteCatalog(basePath);
}

export function createBirdCoderAuthWorkspaceManifest(
  options: CreateBirdCoderAuthWorkspaceManifestOptions = {},
): BirdCoderAuthWorkspaceManifest {
  return birdCoderAuthDefinition.createWorkspaceManifest(options);
}

export function createBirdCoderAuthRouteIntent(
  routeId: BirdCoderAuthRouteId,
  options: CreateBirdCoderAuthRouteIntentOptions = {},
): BirdCoderAuthRouteIntent {
  return birdCoderAuthDefinition.createRouteIntent(routeId, options);
}

export const createAuthWorkspaceManifest = createBirdCoderAuthWorkspaceManifest;
export const createAuthRouteIntent = createBirdCoderAuthRouteIntent;

export const authPackageMeta = {
  architecture: 'birdcoder-auth',
  bridgePackage: '@sdkwork/birdcoder-auth',
  domain: 'user_center',
  package: BIRDCODER_AUTH_SOURCE_PACKAGE,
  status: 'ready',
} as const;

export type AuthPackageMeta = typeof authPackageMeta;
