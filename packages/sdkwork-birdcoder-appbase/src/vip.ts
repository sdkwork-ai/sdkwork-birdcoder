import { BIRDCODER_APPBASE_VIP_SUBSCRIPTION_STORAGE_BINDING } from '@sdkwork/birdcoder-types/storageBindings';

type BirdCoderAppbaseManifestHost = 'browser' | 'tauri' | 'server';

export interface BirdCoderVipCapability {
  capability: 'vip';
  routePath: string;
  sourcePackageName: '@sdkwork/vip-pc-react';
}

export interface BirdCoderVipWorkspaceManifest {
  architecture: 'birdcoder-appbase';
  bridgePackageName: 'sdkwork-birdcoder-appbase';
  capability: 'vip';
  description?: string;
  host: BirdCoderAppbaseManifestHost;
  id: string;
  packageNames: string[];
  routePath: string;
  sourcePackageNames: ['@sdkwork/vip-pc-react'];
  title: string;
}

export interface CreateBirdCoderVipWorkspaceManifestOptions {
  description?: string;
  host?: BirdCoderAppbaseManifestHost;
  id?: string;
  packageNames?: readonly string[];
  routePath?: string;
  title?: string;
}

export interface CreateBirdCoderVipRouteIntentOptions {
  focusWindow?: boolean;
  routePath?: string;
  sectionId?: string;
}

export interface BirdCoderVipRouteIntent {
  capability: 'vip';
  focusWindow: boolean;
  path: string;
  route: string;
  sectionId?: string;
  source: 'vip-workspace';
  sourcePackageName: '@sdkwork/vip-pc-react';
  type: 'vip-route-intent';
}

export interface BirdCoderVipPlan {
  description: string;
  id: 'free' | 'pro' | 'team';
  monthlyPrice: number;
  title: string;
  highlights: string[];
}

export interface BirdCoderVipMembershipSnapshot {
  creditsPerMonth: number;
  planId: BirdCoderVipPlan['id'];
  planTitle: string;
  renewAt: string;
  seats: number;
  status: 'inactive' | 'trialing' | 'active';
}

export const BIRDCODER_APPBASE_VIP_SOURCE_PACKAGE = '@sdkwork/vip-pc-react';
export const BIRDCODER_APPBASE_VIP_STORAGE_SCOPE =
  BIRDCODER_APPBASE_VIP_SUBSCRIPTION_STORAGE_BINDING.storageScope;
export const BIRDCODER_APPBASE_VIP_MEMBERSHIP_KEY =
  BIRDCODER_APPBASE_VIP_SUBSCRIPTION_STORAGE_BINDING.storageKey;

export const BIRDCODER_APPBASE_VIP_PLANS: BirdCoderVipPlan[] = [
  {
    id: 'free',
    title: 'Free',
    monthlyPrice: 0,
    description: 'Local AI IDE essentials for solo evaluation and lightweight daily work.',
    highlights: [
      '1 active workspace profile',
      'Basic CLI engine switching',
      'Local-only history retention',
    ],
  },
  {
    id: 'pro',
    title: 'Pro',
    monthlyPrice: 39,
    description: 'Full desktop workflow with richer governance, previews, and release readiness.',
    highlights: [
      'Unlimited engine switching',
      'Evidence-aware preview and simulator workflows',
      'Priority model governance policies',
    ],
  },
  {
    id: 'team',
    title: 'Team',
    monthlyPrice: 129,
    description: 'Shared governance, seats, entitlements, and release controls for professional teams.',
    highlights: [
      '5 included seats',
      'Shared release evidence retention',
      'Centralized permission and policy profiles',
    ],
  },
];

function normalizeRoutePath(routePath: string | undefined, fallback: string): string {
  const normalizedRoutePath = routePath?.trim();
  if (!normalizedRoutePath || normalizedRoutePath === '/') {
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

export function createBirdCoderVipCapability(routePath = '/vip'): BirdCoderVipCapability {
  const manifest = createBirdCoderVipWorkspaceManifest({ routePath });

  return {
    capability: 'vip',
    routePath: manifest.routePath,
    sourcePackageName: BIRDCODER_APPBASE_VIP_SOURCE_PACKAGE,
  };
}

export function createBirdCoderVipWorkspaceManifest({
  description = 'BirdCoder VIP workspace aligned to sdkwork-appbase membership, entitlement, and upgrade routing standards.',
  host = 'tauri',
  id = 'sdkwork-birdcoder-vip',
  packageNames = ['sdkwork-birdcoder-appbase'],
  routePath = '/vip',
  title = 'VIP',
}: CreateBirdCoderVipWorkspaceManifestOptions = {}): BirdCoderVipWorkspaceManifest {
  return {
    architecture: 'birdcoder-appbase',
    bridgePackageName: 'sdkwork-birdcoder-appbase',
    capability: 'vip',
    description,
    host,
    id,
    packageNames: toUniquePackageNames(packageNames),
    routePath: normalizeRoutePath(routePath, '/vip'),
    sourcePackageNames: [BIRDCODER_APPBASE_VIP_SOURCE_PACKAGE],
    title,
  };
}

export const createVipWorkspaceManifest = createBirdCoderVipWorkspaceManifest;

export function createBirdCoderVipRouteIntent(
  options: CreateBirdCoderVipRouteIntentOptions = {},
): BirdCoderVipRouteIntent {
  const capability = createBirdCoderVipCapability(options.routePath);
  const sectionId = normalizeOptionalText(options.sectionId);
  const queryParams = new URLSearchParams();
  if (sectionId) {
    queryParams.set('section', sectionId);
  }
  const querySuffix = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const route = `${capability.routePath}${querySuffix}`;

  return {
    capability: 'vip',
    focusWindow: options.focusWindow !== false,
    path: route,
    route,
    ...(sectionId ? { sectionId } : {}),
    source: 'vip-workspace',
    sourcePackageName: BIRDCODER_APPBASE_VIP_SOURCE_PACKAGE,
    type: 'vip-route-intent',
  };
}

export const createVipRouteIntent = createBirdCoderVipRouteIntent;

export const vipPackageMeta = {
  architecture: 'birdcoder-appbase',
  bridgePackage: 'sdkwork-birdcoder-appbase',
  domain: 'commerce',
  package: BIRDCODER_APPBASE_VIP_SOURCE_PACKAGE,
  status: 'ready',
} as const;

export type VipPackageMeta = typeof vipPackageMeta;
