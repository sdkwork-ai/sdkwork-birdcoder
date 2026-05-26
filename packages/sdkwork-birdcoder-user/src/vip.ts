export const BIRDCODER_VIP_ROUTE_PATH = '/vip';
export const BIRDCODER_VIP_PACKAGE_NAME = '@sdkwork/birdcoder-user';

export interface BirdCoderVipWorkspaceManifest {
  architecture: 'birdcoder-vip';
  bridgePackage: typeof BIRDCODER_VIP_PACKAGE_NAME;
  bridgePackageName: typeof BIRDCODER_VIP_PACKAGE_NAME;
  domain: 'commerce';
  id: 'sdkwork-birdcoder-vip';
  package: typeof BIRDCODER_VIP_PACKAGE_NAME;
  routePath: string;
  status: 'ready';
  title: string;
}

export interface CreateBirdCoderVipWorkspaceManifestOptions {
  basePath?: string;
  routePath?: string;
  title?: string;
}

export interface BirdCoderVipRouteIntent {
  focusWindow?: boolean;
  group?: string;
  package: typeof BIRDCODER_VIP_PACKAGE_NAME;
  routePath: string;
}

export interface CreateBirdCoderVipRouteIntentOptions {
  basePath?: string;
  focusWindow?: boolean;
  group?: string;
  routePath?: string;
}

export function createBirdCoderVipWorkspaceManifest(
  options: CreateBirdCoderVipWorkspaceManifestOptions = {},
): BirdCoderVipWorkspaceManifest {
  return {
    architecture: 'birdcoder-vip',
    bridgePackage: BIRDCODER_VIP_PACKAGE_NAME,
    bridgePackageName: BIRDCODER_VIP_PACKAGE_NAME,
    domain: 'commerce',
    id: 'sdkwork-birdcoder-vip',
    package: BIRDCODER_VIP_PACKAGE_NAME,
    routePath: resolveVipRoutePath(options),
    status: 'ready',
    title: options.title ?? 'Membership',
  };
}

export function createBirdCoderVipRouteIntent(
  options: CreateBirdCoderVipRouteIntentOptions = {},
): BirdCoderVipRouteIntent {
  return {
    ...(typeof options.focusWindow === 'boolean' ? { focusWindow: options.focusWindow } : {}),
    ...(options.group ? { group: options.group } : {}),
    package: BIRDCODER_VIP_PACKAGE_NAME,
    routePath: resolveVipRoutePath(options),
  };
}

export const createVipWorkspaceManifest = createBirdCoderVipWorkspaceManifest;
export const createVipRouteIntent = createBirdCoderVipRouteIntent;

export const vipPackageMeta = {
  architecture: 'birdcoder-vip',
  bridgePackage: BIRDCODER_VIP_PACKAGE_NAME,
  bridgePackageName: BIRDCODER_VIP_PACKAGE_NAME,
  domain: 'commerce',
  package: BIRDCODER_VIP_PACKAGE_NAME,
  status: 'ready',
} as const;

export type VipPackageMeta = typeof vipPackageMeta;

function resolveVipRoutePath(
  options: CreateBirdCoderVipWorkspaceManifestOptions | CreateBirdCoderVipRouteIntentOptions,
): string {
  return options.routePath ?? options.basePath ?? BIRDCODER_VIP_ROUTE_PATH;
}
