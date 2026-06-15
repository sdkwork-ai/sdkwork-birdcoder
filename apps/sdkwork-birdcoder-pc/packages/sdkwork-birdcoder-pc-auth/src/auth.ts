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

export type BirdCoderAuthRouteId = SdkworkAuthRouteId;
export type BirdCoderAuthRouteDefinition =
  SdkworkCanonicalAuthRouteDefinition<'@sdkwork/auth-pc-react'>;
export type BirdCoderAuthRouteIntent = SdkworkCanonicalAuthRouteIntent<'@sdkwork/auth-pc-react'>;
export type BirdCoderAuthWorkspaceManifest = SdkworkCanonicalAuthWorkspaceManifest<
  'birdcoder-auth',
  '@sdkwork/birdcoder-pc-auth',
  '@sdkwork/auth-pc-react'
>;
export type BirdCoderAuthDefinition = SdkworkCanonicalAuthDefinition<
  'birdcoder-auth',
  '@sdkwork/birdcoder-pc-auth',
  '@sdkwork/auth-pc-react'
>;
export type CreateBirdCoderAuthWorkspaceManifestOptions =
  CreateSdkworkCanonicalAuthDefinitionWorkspaceManifestOptions;
export type CreateBirdCoderAuthRouteIntentOptions =
  CreateSdkworkCanonicalAuthDefinitionRouteIntentOptions<'@sdkwork/auth-pc-react'>;

export const BIRDCODER_AUTH_BASE_PATH = '/auth';
export const BIRDCODER_AUTH_STORAGE_SCOPE = 'sdkwork-birdcoder.iam';
export const BIRDCODER_AUTH_SESSION_KEY = 'sdkwork.birdcoder.appSession.v1';

const birdCoderAuthDefinition = createSdkworkCanonicalAuthDefinition({
  architecture: 'birdcoder-auth',
  basePath: BIRDCODER_AUTH_BASE_PATH,
  bridgePackageName: '@sdkwork/birdcoder-pc-auth',
  description:
    'BirdCoder auth workspace aligned to SDKWork IAM login, recovery, OAuth callback, and QR-entry standards.',
  host: 'tauri',
  id: 'sdkwork-birdcoder-auth',
  packageNames: ['@sdkwork/birdcoder-pc-auth'],
  sourcePackageName: '@sdkwork/auth-pc-react',
  title: 'Auth',
});

export const BIRDCODER_AUTH_DEFINITION = birdCoderAuthDefinition;
export const BIRDCODER_AUTH_SOURCE_PACKAGE = birdCoderAuthDefinition.sourcePackageName;

export function createBirdCoderAuthRouteCatalog(
  basePath: string = BIRDCODER_AUTH_BASE_PATH,
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
  bridgePackage: '@sdkwork/birdcoder-pc-auth',
  domain: 'iam',
  package: BIRDCODER_AUTH_SOURCE_PACKAGE,
  status: 'ready',
} as const;

export type AuthPackageMeta = typeof authPackageMeta;
