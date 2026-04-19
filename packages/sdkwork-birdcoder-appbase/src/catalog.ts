import {
  authPackageMeta,
  createBirdCoderAuthWorkspaceManifest,
} from './auth';
import {
  createBirdCoderUserWorkspaceManifest,
  userPackageMeta,
} from './user';
import {
  createBirdCoderVipWorkspaceManifest,
  vipPackageMeta,
} from './vip';

export type BirdCoderAppbaseDomain = 'user_center' | 'commerce';
export type BirdCoderAppbaseCapabilityName = 'auth' | 'user' | 'vip';
export type BirdCoderAppbaseHost = 'browser' | 'tauri' | 'server';

export interface BirdCoderAppbaseCapabilityMeta {
  bridgePackageName: 'sdkwork-birdcoder-appbase';
  capability: BirdCoderAppbaseCapabilityName;
  description: string;
  domain: BirdCoderAppbaseDomain;
  routePath: string;
  sourcePackageName:
    | '@sdkwork/auth-pc-react'
    | '@sdkwork/user-pc-react'
    | '@sdkwork/vip-pc-react';
  title: string;
}

export interface BirdCoderAppbaseDomainMeta {
  domain: BirdCoderAppbaseDomain;
  label: string;
  packages: BirdCoderAppbaseCapabilityMeta[];
}

export interface BirdCoderAppbaseCapabilityRegistry {
  domains: BirdCoderAppbaseDomainMeta[];
  packages: BirdCoderAppbaseCapabilityMeta[];
  packagesByDomain: Record<BirdCoderAppbaseDomain, BirdCoderAppbaseCapabilityMeta[]>;
  packagesByName: Record<BirdCoderAppbaseCapabilityName, BirdCoderAppbaseCapabilityMeta>;
  packagesBySourcePackageName: Record<BirdCoderAppbaseCapabilityMeta['sourcePackageName'], BirdCoderAppbaseCapabilityMeta>;
}

export interface BirdCoderAppbaseManifest {
  architecture: 'birdcoder-appbase';
  bridgePackageName: 'sdkwork-birdcoder-appbase';
  capabilityNames: BirdCoderAppbaseCapabilityName[];
  description?: string;
  host: BirdCoderAppbaseHost;
  id: string;
  sourcePackageNames: BirdCoderAppbaseCapabilityMeta['sourcePackageName'][];
  title: string;
}

export interface CreateBirdCoderAppbaseManifestOptions {
  capabilities?: readonly BirdCoderAppbaseCapabilityName[];
  description?: string;
  host?: BirdCoderAppbaseHost;
  id: string;
  title: string;
}

export const BIRDCODER_APPBASE_DOMAIN_ORDER: BirdCoderAppbaseDomain[] = ['user_center', 'commerce'];

export const BIRDCODER_APPBASE_DOMAIN_LABELS: Record<BirdCoderAppbaseDomain, string> = {
  commerce: 'Commerce',
  user_center: 'User Center',
};

export const BIRDCODER_APPBASE_CAPABILITY_CATALOG: BirdCoderAppbaseCapabilityMeta[] = [
  {
    bridgePackageName: 'sdkwork-birdcoder-appbase',
    capability: 'auth',
    description: 'Appbase-aligned authentication, session, and access-entry surfaces for BirdCoder.',
    domain: 'user_center',
    routePath: createBirdCoderAuthWorkspaceManifest().loginRoutePath,
    sourcePackageName: authPackageMeta.package,
    title: 'Auth',
  },
  {
    bridgePackageName: 'sdkwork-birdcoder-appbase',
    capability: 'user',
    description: 'Appbase-aligned user center and account profile orchestration for BirdCoder.',
    domain: 'user_center',
    routePath: createBirdCoderUserWorkspaceManifest().routePath,
    sourcePackageName: userPackageMeta.package,
    title: 'User',
  },
  {
    bridgePackageName: 'sdkwork-birdcoder-appbase',
    capability: 'vip',
    description: 'Appbase-aligned membership tiers, entitlements, and upgrade orchestration for BirdCoder.',
    domain: 'commerce',
    routePath: createBirdCoderVipWorkspaceManifest().routePath,
    sourcePackageName: vipPackageMeta.package,
    title: 'VIP',
  },
];

export function createBirdCoderAppbaseCatalog(): BirdCoderAppbaseCapabilityRegistry {
  const packages = [...BIRDCODER_APPBASE_CAPABILITY_CATALOG];
  const packagesByDomain = BIRDCODER_APPBASE_DOMAIN_ORDER.reduce<
    Record<BirdCoderAppbaseDomain, BirdCoderAppbaseCapabilityMeta[]>
  >((accumulator, domain) => {
    accumulator[domain] = packages.filter((item) => item.domain === domain);
    return accumulator;
  }, {} as Record<BirdCoderAppbaseDomain, BirdCoderAppbaseCapabilityMeta[]>);

  const packagesByName = packages.reduce<Record<BirdCoderAppbaseCapabilityName, BirdCoderAppbaseCapabilityMeta>>(
    (accumulator, item) => {
      accumulator[item.capability] = item;
      return accumulator;
    },
    {} as Record<BirdCoderAppbaseCapabilityName, BirdCoderAppbaseCapabilityMeta>,
  );

  const packagesBySourcePackageName = packages.reduce<
    Record<BirdCoderAppbaseCapabilityMeta['sourcePackageName'], BirdCoderAppbaseCapabilityMeta>
  >((accumulator, item) => {
    accumulator[item.sourcePackageName] = item;
    return accumulator;
  }, {} as Record<BirdCoderAppbaseCapabilityMeta['sourcePackageName'], BirdCoderAppbaseCapabilityMeta>);

  return {
    domains: BIRDCODER_APPBASE_DOMAIN_ORDER.map((domain) => ({
      domain,
      label: BIRDCODER_APPBASE_DOMAIN_LABELS[domain],
      packages: packagesByDomain[domain],
    })),
    packages,
    packagesByDomain,
    packagesByName,
    packagesBySourcePackageName,
  };
}

export function resolveBirdCoderAppbaseCapabilities(
  options: {
    capabilities?: readonly BirdCoderAppbaseCapabilityName[];
    domains?: readonly BirdCoderAppbaseDomain[];
  } = {},
): BirdCoderAppbaseCapabilityMeta[] {
  const registry = createBirdCoderAppbaseCatalog();
  const resolved = new Map<BirdCoderAppbaseCapabilityName, BirdCoderAppbaseCapabilityMeta>();

  for (const domain of options.domains ?? []) {
    for (const item of registry.packagesByDomain[domain] ?? []) {
      resolved.set(item.capability, item);
    }
  }

  for (const capability of options.capabilities ?? []) {
    resolved.set(capability, getBirdCoderAppbaseCapability(capability));
  }

  if (resolved.size === 0) {
    for (const item of registry.packages) {
      resolved.set(item.capability, item);
    }
  }

  return registry.packages.filter((item) => resolved.has(item.capability));
}

export function createBirdCoderAppbaseManifest({
  capabilities,
  description,
  host = 'tauri',
  id,
  title,
}: CreateBirdCoderAppbaseManifestOptions): BirdCoderAppbaseManifest {
  const selectedPackages = resolveBirdCoderAppbaseCapabilities({ capabilities });

  return {
    architecture: 'birdcoder-appbase',
    bridgePackageName: 'sdkwork-birdcoder-appbase',
    capabilityNames: selectedPackages.map((item) => item.capability),
    description,
    host,
    id,
    sourcePackageNames: selectedPackages.map((item) => item.sourcePackageName),
    title,
  };
}

export function getBirdCoderAppbaseCapability(
  capability: BirdCoderAppbaseCapabilityName,
): BirdCoderAppbaseCapabilityMeta {
  const resolved = createBirdCoderAppbaseCatalog().packagesByName[capability];
  if (!resolved) {
    throw new Error(`Unknown BirdCoder appbase capability: ${capability}`);
  }

  return resolved;
}
