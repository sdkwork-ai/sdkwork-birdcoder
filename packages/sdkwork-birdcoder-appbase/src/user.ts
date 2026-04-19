import { BIRDCODER_APPBASE_USER_PROFILE_STORAGE_BINDING } from '@sdkwork/birdcoder-types/storageBindings';

type BirdCoderAppbaseManifestHost = 'browser' | 'tauri' | 'server';
export type BirdCoderUserSectionId = 'overview' | 'profile' | 'security' | 'membership';

export interface BirdCoderUserCapability {
  capability: 'user';
  routePath: string;
  sectionRoutePattern: string;
  sourcePackageName: '@sdkwork/user-pc-react';
}

export interface BirdCoderUserWorkspaceManifest {
  architecture: 'birdcoder-appbase';
  bridgePackageName: 'sdkwork-birdcoder-appbase';
  capability: 'user';
  description?: string;
  host: BirdCoderAppbaseManifestHost;
  id: string;
  packageNames: string[];
  routePath: string;
  sectionRoutePattern: string;
  sourcePackageNames: ['@sdkwork/user-pc-react'];
  title: string;
}

export interface CreateBirdCoderUserWorkspaceManifestOptions {
  description?: string;
  host?: BirdCoderAppbaseManifestHost;
  id?: string;
  packageNames?: readonly string[];
  routePath?: string;
  title?: string;
}

export interface CreateBirdCoderUserRouteIntentOptions {
  focusWindow?: boolean;
  routePath?: string;
  sectionId?: BirdCoderUserSectionId;
}

export interface CreateBirdCoderUserSectionRouteIntentOptions {
  focusWindow?: boolean;
  routePath?: string;
}

export interface BirdCoderUserRouteIntent {
  capability: 'user';
  focusWindow: boolean;
  path: string;
  route: string;
  source: 'user-workspace';
  sourcePackageName: '@sdkwork/user-pc-react';
  type: 'user-route-intent';
}

export interface BirdCoderUserSectionRouteIntent {
  capability: 'user';
  focusWindow: boolean;
  path: string;
  route: string;
  sectionId: BirdCoderUserSectionId;
  source: 'user-workspace';
  sourcePackageName: '@sdkwork/user-pc-react';
  type: 'user-section-route-intent';
}

export const BIRDCODER_APPBASE_USER_SOURCE_PACKAGE = '@sdkwork/user-pc-react';
export const BIRDCODER_APPBASE_USER_STORAGE_SCOPE =
  BIRDCODER_APPBASE_USER_PROFILE_STORAGE_BINDING.storageScope;
export const BIRDCODER_APPBASE_USER_PROFILE_KEY =
  BIRDCODER_APPBASE_USER_PROFILE_STORAGE_BINDING.storageKey;

function normalizeRoutePath(routePath: string | undefined, fallback: string): string {
  const normalizedRoutePath = routePath?.trim();
  if (!normalizedRoutePath || normalizedRoutePath === '/') {
    return fallback;
  }

  return normalizedRoutePath.startsWith('/') ? normalizedRoutePath : `/${normalizedRoutePath}`;
}

function toUniquePackageNames(packageNames: readonly string[]): string[] {
  return Array.from(new Set(packageNames.map((packageName) => packageName.trim()).filter(Boolean)));
}

export function createBirdCoderUserCapability(routePath = '/user'): BirdCoderUserCapability {
  const manifest = createBirdCoderUserWorkspaceManifest({ routePath });

  return {
    capability: 'user',
    routePath: manifest.routePath,
    sectionRoutePattern: manifest.sectionRoutePattern,
    sourcePackageName: BIRDCODER_APPBASE_USER_SOURCE_PACKAGE,
  };
}

export function createBirdCoderUserWorkspaceManifest({
  description = 'BirdCoder user workspace aligned to sdkwork-appbase account-center routing, section navigation, and profile orchestration standards.',
  host = 'tauri',
  id = 'sdkwork-birdcoder-user',
  packageNames = ['sdkwork-birdcoder-appbase'],
  routePath = '/user',
  title = 'User',
}: CreateBirdCoderUserWorkspaceManifestOptions = {}): BirdCoderUserWorkspaceManifest {
  const normalizedRoutePath = normalizeRoutePath(routePath, '/user');

  return {
    architecture: 'birdcoder-appbase',
    bridgePackageName: 'sdkwork-birdcoder-appbase',
    capability: 'user',
    description,
    host,
    id,
    packageNames: toUniquePackageNames(packageNames),
    routePath: normalizedRoutePath,
    sectionRoutePattern: `${normalizedRoutePath}/sections/:sectionId`,
    sourcePackageNames: [BIRDCODER_APPBASE_USER_SOURCE_PACKAGE],
    title,
  };
}

export const createUserWorkspaceManifest = createBirdCoderUserWorkspaceManifest;

export function createBirdCoderUserRouteIntent(
  options: CreateBirdCoderUserRouteIntentOptions = {},
): BirdCoderUserRouteIntent | BirdCoderUserSectionRouteIntent {
  if (options.sectionId) {
    return createBirdCoderUserSectionRouteIntent(options.sectionId, {
      focusWindow: options.focusWindow,
      routePath: options.routePath,
    });
  }

  const capability = createBirdCoderUserCapability(options.routePath);

  return {
    capability: 'user',
    focusWindow: options.focusWindow !== false,
    path: capability.routePath,
    route: capability.routePath,
    source: 'user-workspace',
    sourcePackageName: BIRDCODER_APPBASE_USER_SOURCE_PACKAGE,
    type: 'user-route-intent',
  };
}

export const createUserRouteIntent = createBirdCoderUserRouteIntent;

export function createBirdCoderUserSectionRouteIntent(
  sectionId: BirdCoderUserSectionId,
  options: CreateBirdCoderUserSectionRouteIntentOptions = {},
): BirdCoderUserSectionRouteIntent {
  const capability = createBirdCoderUserCapability(options.routePath);
  const route = `${capability.routePath}/sections/${sectionId}`;

  return {
    capability: 'user',
    focusWindow: options.focusWindow !== false,
    path: route,
    route,
    sectionId,
    source: 'user-workspace',
    sourcePackageName: BIRDCODER_APPBASE_USER_SOURCE_PACKAGE,
    type: 'user-section-route-intent',
  };
}

export const createUserSectionRouteIntent = createBirdCoderUserSectionRouteIntent;

export const userPackageMeta = {
  architecture: 'birdcoder-appbase',
  bridgePackage: 'sdkwork-birdcoder-appbase',
  domain: 'user_center',
  package: BIRDCODER_APPBASE_USER_SOURCE_PACKAGE,
  status: 'ready',
} as const;

export type UserPackageMeta = typeof userPackageMeta;
