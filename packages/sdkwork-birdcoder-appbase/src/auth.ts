import { BIRDCODER_APPBASE_AUTH_STORAGE_BINDING } from '@sdkwork/birdcoder-types/storageBindings';

type BirdCoderAppbaseManifestHost = 'browser' | 'tauri' | 'server';
export type BirdCoderAuthRouteId =
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'oauth-callback'
  | 'qr-login';

export interface BirdCoderAuthRouteDefinition {
  access: 'anonymous-only';
  capability: 'auth';
  id: BirdCoderAuthRouteId;
  path: string;
  sourcePackageName: '@sdkwork/auth-pc-react';
}

export interface BirdCoderAuthWorkspaceManifest {
  architecture: 'birdcoder-appbase';
  bridgePackageName: 'sdkwork-birdcoder-appbase';
  capability: 'auth';
  description?: string;
  forgotPasswordRoutePath: string;
  host: BirdCoderAppbaseManifestHost;
  id: string;
  loginRoutePath: string;
  oauthCallbackRoutePattern: string;
  packageNames: string[];
  qrRoutePath: string;
  registerRoutePath: string;
  sourcePackageNames: ['@sdkwork/auth-pc-react'];
  title: string;
}

export interface CreateBirdCoderAuthWorkspaceManifestOptions {
  basePath?: string;
  description?: string;
  forgotPasswordRoutePath?: string;
  host?: BirdCoderAppbaseManifestHost;
  id?: string;
  loginRoutePath?: string;
  oauthCallbackRoutePattern?: string;
  packageNames?: readonly string[];
  qrRoutePath?: string;
  registerRoutePath?: string;
  title?: string;
}

export interface CreateBirdCoderAuthRouteIntentOptions {
  basePath?: string;
  focusWindow?: boolean;
  provider?: string;
  redirectTo?: string | null;
  routes?: readonly BirdCoderAuthRouteDefinition[];
}

export interface BirdCoderAuthRouteIntent {
  capability: 'auth';
  focusWindow: boolean;
  path: string;
  provider?: string;
  redirectTo?: string;
  route: string;
  routeId: BirdCoderAuthRouteId;
  source: 'auth-workspace';
  sourcePackageName: '@sdkwork/auth-pc-react';
  type: 'auth-route-intent';
}

interface BirdCoderAuthWorkspaceRoutes {
  forgotPasswordRoutePath: string;
  loginRoutePath: string;
  oauthCallbackRoutePattern: string;
  qrRoutePath: string;
  registerRoutePath: string;
}

export const BIRDCODER_APPBASE_AUTH_SOURCE_PACKAGE = '@sdkwork/auth-pc-react';
export const BIRDCODER_APPBASE_AUTH_STORAGE_SCOPE =
  BIRDCODER_APPBASE_AUTH_STORAGE_BINDING.storageScope;
export const BIRDCODER_APPBASE_AUTH_SESSION_KEY =
  BIRDCODER_APPBASE_AUTH_STORAGE_BINDING.storageKey;

function normalizeBasePath(basePath: string | undefined, fallback: string): string {
  const normalizedBasePath = (basePath ?? fallback).trim().replace(/\/+$/, '');
  return normalizedBasePath || fallback;
}

function normalizeRoutePath(routePath: string | undefined, fallback: string): string {
  const normalizedRoutePath = routePath?.trim();
  if (!normalizedRoutePath) {
    return fallback;
  }

  return normalizedRoutePath.startsWith('/') ? normalizedRoutePath : `/${normalizedRoutePath}`;
}

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : undefined;
}

function toUniquePackageNames(packageNames: readonly string[]): string[] {
  return Array.from(new Set(packageNames.map((packageName) => packageName.trim()).filter(Boolean)));
}

function resolveAuthWorkspaceRoutes(basePath: string): BirdCoderAuthWorkspaceRoutes {
  return {
    forgotPasswordRoutePath: `${basePath}/forgot-password`,
    loginRoutePath: `${basePath}/login`,
    oauthCallbackRoutePattern: `${basePath}/oauth/callback/:provider`,
    qrRoutePath: `${basePath}/qr-login`,
    registerRoutePath: `${basePath}/register`,
  };
}

function resolveAuthRouteDefinition(
  routeId: BirdCoderAuthRouteId,
  routes: readonly BirdCoderAuthRouteDefinition[],
): BirdCoderAuthRouteDefinition {
  const route = routes.find((item) => item.id === routeId);
  if (!route) {
    throw new Error(`Unknown auth route: ${routeId}`);
  }

  return route;
}

function buildAuthRoute(
  route: BirdCoderAuthRouteDefinition,
  options: CreateBirdCoderAuthRouteIntentOptions,
): string {
  let resolvedRoute = route.path;

  if (route.id === 'oauth-callback') {
    const provider = normalizeOptionalText(options.provider);
    if (!provider) {
      throw new Error('OAuth callback route requires a provider.');
    }

    resolvedRoute = resolvedRoute.replace(':provider', encodeURIComponent(provider));
  }

  const redirectTo = normalizeOptionalText(options.redirectTo);
  if (redirectTo) {
    const queryParams = new URLSearchParams();
    queryParams.set('redirectTo', redirectTo);
    resolvedRoute = `${resolvedRoute}?${queryParams.toString()}`;
  }

  return resolvedRoute;
}

export function createBirdCoderAuthRouteCatalog(
  basePath = '/auth',
): BirdCoderAuthRouteDefinition[] {
  const normalizedBasePath = normalizeBasePath(basePath, '/auth');
  const routes = resolveAuthWorkspaceRoutes(normalizedBasePath);

  return [
    {
      access: 'anonymous-only',
      capability: 'auth',
      id: 'login',
      path: routes.loginRoutePath,
      sourcePackageName: BIRDCODER_APPBASE_AUTH_SOURCE_PACKAGE,
    },
    {
      access: 'anonymous-only',
      capability: 'auth',
      id: 'register',
      path: routes.registerRoutePath,
      sourcePackageName: BIRDCODER_APPBASE_AUTH_SOURCE_PACKAGE,
    },
    {
      access: 'anonymous-only',
      capability: 'auth',
      id: 'forgot-password',
      path: routes.forgotPasswordRoutePath,
      sourcePackageName: BIRDCODER_APPBASE_AUTH_SOURCE_PACKAGE,
    },
    {
      access: 'anonymous-only',
      capability: 'auth',
      id: 'oauth-callback',
      path: routes.oauthCallbackRoutePattern,
      sourcePackageName: BIRDCODER_APPBASE_AUTH_SOURCE_PACKAGE,
    },
    {
      access: 'anonymous-only',
      capability: 'auth',
      id: 'qr-login',
      path: routes.qrRoutePath,
      sourcePackageName: BIRDCODER_APPBASE_AUTH_SOURCE_PACKAGE,
    },
  ];
}

export const createAuthRouteCatalog = createBirdCoderAuthRouteCatalog;

export function createBirdCoderAuthWorkspaceManifest({
  basePath = '/auth',
  description = 'BirdCoder auth workspace aligned to sdkwork-appbase login, recovery, OAuth callback, and QR-entry standards.',
  forgotPasswordRoutePath,
  host = 'tauri',
  id = 'sdkwork-birdcoder-auth',
  loginRoutePath,
  oauthCallbackRoutePattern,
  packageNames = ['sdkwork-birdcoder-appbase'],
  qrRoutePath,
  registerRoutePath,
  title = 'Auth',
}: CreateBirdCoderAuthWorkspaceManifestOptions = {}): BirdCoderAuthWorkspaceManifest {
  const normalizedBasePath = normalizeBasePath(basePath, '/auth');
  const defaultRoutes = resolveAuthWorkspaceRoutes(normalizedBasePath);

  return {
    architecture: 'birdcoder-appbase',
    bridgePackageName: 'sdkwork-birdcoder-appbase',
    capability: 'auth',
    description,
    forgotPasswordRoutePath: normalizeRoutePath(
      forgotPasswordRoutePath,
      defaultRoutes.forgotPasswordRoutePath,
    ),
    host,
    id,
    loginRoutePath: normalizeRoutePath(loginRoutePath, defaultRoutes.loginRoutePath),
    oauthCallbackRoutePattern: normalizeRoutePath(
      oauthCallbackRoutePattern,
      defaultRoutes.oauthCallbackRoutePattern,
    ),
    packageNames: toUniquePackageNames(packageNames),
    qrRoutePath: normalizeRoutePath(qrRoutePath, defaultRoutes.qrRoutePath),
    registerRoutePath: normalizeRoutePath(registerRoutePath, defaultRoutes.registerRoutePath),
    sourcePackageNames: [BIRDCODER_APPBASE_AUTH_SOURCE_PACKAGE],
    title,
  };
}

export const createAuthWorkspaceManifest = createBirdCoderAuthWorkspaceManifest;

export function createBirdCoderAuthRouteIntent(
  routeId: BirdCoderAuthRouteId,
  options: CreateBirdCoderAuthRouteIntentOptions = {},
): BirdCoderAuthRouteIntent {
  const routes = options.routes ?? createBirdCoderAuthRouteCatalog(options.basePath);
  const route = resolveAuthRouteDefinition(routeId, routes);
  const resolvedRoute = buildAuthRoute(route, options);
  const provider = normalizeOptionalText(options.provider);
  const redirectTo = normalizeOptionalText(options.redirectTo);

  return {
    capability: 'auth',
    focusWindow: options.focusWindow !== false,
    path: resolvedRoute,
    ...(provider ? { provider } : {}),
    ...(redirectTo ? { redirectTo } : {}),
    route: resolvedRoute,
    routeId,
    source: 'auth-workspace',
    sourcePackageName: BIRDCODER_APPBASE_AUTH_SOURCE_PACKAGE,
    type: 'auth-route-intent',
  };
}

export const createAuthRouteIntent = createBirdCoderAuthRouteIntent;

export const authPackageMeta = {
  architecture: 'birdcoder-appbase',
  bridgePackage: 'sdkwork-birdcoder-appbase',
  domain: 'identity',
  package: BIRDCODER_APPBASE_AUTH_SOURCE_PACKAGE,
  status: 'ready',
} as const;

export type AuthPackageMeta = typeof authPackageMeta;
