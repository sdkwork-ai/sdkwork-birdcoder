import {
  createSdkworkCanonicalUserDefinition,
  type CreateSdkworkCanonicalUserDefinitionRouteIntentOptions,
  type CreateSdkworkCanonicalUserDefinitionSectionRouteIntentOptions,
  type CreateSdkworkCanonicalUserDefinitionWorkspaceManifestOptions,
  type SdkworkCanonicalUserCapability,
  type SdkworkCanonicalUserDefinition,
  type SdkworkCanonicalUserRouteIntent,
  type SdkworkCanonicalUserSectionRouteIntent,
  type SdkworkCanonicalUserWorkspaceManifest,
} from '@sdkwork/user-pc-react';
import { BIRDCODER_APPBASE_USER_PROFILE_STORAGE_BINDING } from '@sdkwork/birdcoder-types';
import { BIRDCODER_USER_CENTER_ROUTES } from '@sdkwork/birdcoder-core';

export type BirdCoderUserSectionId = 'overview' | 'profile' | 'security' | 'membership';
export type BirdCoderUserCapability = SdkworkCanonicalUserCapability<'@sdkwork/user-pc-react'>;
export type BirdCoderUserRouteIntent = SdkworkCanonicalUserRouteIntent<'@sdkwork/user-pc-react'>;
export type BirdCoderUserSectionRouteIntent =
  SdkworkCanonicalUserSectionRouteIntent<'@sdkwork/user-pc-react'>;
export type BirdCoderUserWorkspaceManifest = SdkworkCanonicalUserWorkspaceManifest<
  'birdcoder-user',
  '@sdkwork/birdcoder-user',
  '@sdkwork/user-pc-react'
>;
export type BirdCoderUserDefinition = SdkworkCanonicalUserDefinition<
  'birdcoder-user',
  '@sdkwork/birdcoder-user',
  '@sdkwork/user-pc-react'
>;
export type CreateBirdCoderUserWorkspaceManifestOptions =
  CreateSdkworkCanonicalUserDefinitionWorkspaceManifestOptions;
export interface CreateBirdCoderUserRouteIntentOptions
  extends CreateSdkworkCanonicalUserDefinitionRouteIntentOptions<'@sdkwork/user-pc-react'> {
  sectionId?: BirdCoderUserSectionId;
}
export type CreateBirdCoderUserSectionRouteIntentOptions =
  CreateSdkworkCanonicalUserDefinitionSectionRouteIntentOptions<'@sdkwork/user-pc-react'>;

const birdCoderUserDefinition = createSdkworkCanonicalUserDefinition({
  architecture: 'birdcoder-user',
  bridgePackageName: '@sdkwork/birdcoder-user',
  description:
    'BirdCoder user workspace aligned to sdkwork-appbase account-center routing, section navigation, and profile orchestration standards.',
  host: 'tauri',
  id: 'sdkwork-birdcoder-user',
  packageNames: ['@sdkwork/birdcoder-user'],
  routePath: BIRDCODER_USER_CENTER_ROUTES.userRoutePath,
  sourcePackageName: '@sdkwork/user-pc-react',
  title: 'User',
});

export const BIRDCODER_USER_DEFINITION = birdCoderUserDefinition;
export const BIRDCODER_USER_SOURCE_PACKAGE = birdCoderUserDefinition.sourcePackageName;
export const BIRDCODER_USER_STORAGE_SCOPE =
  BIRDCODER_APPBASE_USER_PROFILE_STORAGE_BINDING.storageScope;
export const BIRDCODER_USER_PROFILE_KEY =
  BIRDCODER_APPBASE_USER_PROFILE_STORAGE_BINDING.storageKey;

export function createBirdCoderUserCapability(
  routePath: string = BIRDCODER_USER_CENTER_ROUTES.userRoutePath,
): BirdCoderUserCapability {
  return birdCoderUserDefinition.createCapability(routePath);
}

export function createBirdCoderUserWorkspaceManifest(
  options: CreateBirdCoderUserWorkspaceManifestOptions = {},
): BirdCoderUserWorkspaceManifest {
  return birdCoderUserDefinition.createWorkspaceManifest(options);
}

export function createBirdCoderUserRouteIntent(
  options: CreateBirdCoderUserRouteIntentOptions = {},
): BirdCoderUserRouteIntent | BirdCoderUserSectionRouteIntent {
  if (options.sectionId) {
    return createBirdCoderUserSectionRouteIntent(options.sectionId, {
      basePath: options.basePath,
      focusWindow: options.focusWindow,
      group: options.group,
    });
  }

  return birdCoderUserDefinition.createRouteIntent(options);
}

export function createBirdCoderUserSectionRouteIntent(
  sectionId: BirdCoderUserSectionId,
  options: CreateBirdCoderUserSectionRouteIntentOptions = {},
): BirdCoderUserSectionRouteIntent {
  return birdCoderUserDefinition.createSectionRouteIntent(sectionId, options);
}

export const createUserWorkspaceManifest = createBirdCoderUserWorkspaceManifest;
export const createUserRouteIntent = createBirdCoderUserRouteIntent;
export const createUserSectionRouteIntent = createBirdCoderUserSectionRouteIntent;

export const userPackageMeta = {
  architecture: 'birdcoder-user',
  bridgePackage: '@sdkwork/birdcoder-user',
  domain: 'user_center',
  package: BIRDCODER_USER_SOURCE_PACKAGE,
  status: 'ready',
} as const;

export type UserPackageMeta = typeof userPackageMeta;
