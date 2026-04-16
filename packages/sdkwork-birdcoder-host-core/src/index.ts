export const SDKWORK_BIRD_HOST_CORE_PACKAGE = 'sdkwork-birdcoder-host-core';
export const BIRDCODER_DEFAULT_LOCAL_API_HOST = '127.0.0.1';
export const BIRDCODER_DEFAULT_LOCAL_API_PORT = 10240;
export const BIRDCODER_DEFAULT_LOCAL_API_BASE_URL =
  `http://${BIRDCODER_DEFAULT_LOCAL_API_HOST}:${BIRDCODER_DEFAULT_LOCAL_API_PORT}`;

export const SDKWORK_BIRD_HOST_MODES = [
  'web',
  'desktop',
  'server',
] as const;

export type BirdHostMode = (typeof SDKWORK_BIRD_HOST_MODES)[number];

export interface BirdHostDescriptor {
  mode: BirdHostMode;
  appId: string;
  appName: string;
  distributionId: string;
  apiBaseUrl: string;
}

export interface BirdHostDistributionInput {
  id: string;
  appId: string;
  appName: string;
  apiBaseUrl: string;
}

export function createBirdHostDescriptor(
  overrides: Partial<BirdHostDescriptor> = {},
): BirdHostDescriptor {
  return {
    mode: overrides.mode ?? 'web',
    appId: overrides.appId ?? 'sdkwork-birdcoder',
    appName: overrides.appName ?? 'SDKWork BirdCoder',
    distributionId: overrides.distributionId ?? 'global',
    apiBaseUrl: overrides.apiBaseUrl ?? BIRDCODER_DEFAULT_LOCAL_API_BASE_URL,
  };
}

export function createBirdHostDescriptorFromDistribution(
  mode: BirdHostMode,
  distribution: BirdHostDistributionInput,
  overrides: Partial<BirdHostDescriptor> = {},
): BirdHostDescriptor {
  return createBirdHostDescriptor({
    mode,
    appId: distribution.appId,
    appName: distribution.appName,
    distributionId: distribution.id,
    apiBaseUrl: distribution.apiBaseUrl,
    ...overrides,
  });
}
