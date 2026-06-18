import { getDistributionManifest } from '@sdkwork/birdcoder-pc-distribution';
import {
  createBirdHostDescriptorFromDistribution,
  type BirdHostDescriptor,
} from '@sdkwork/birdcoder-pc-host-core';

export function resolveDesktopRuntime(
  distributionId: 'cn' | 'global' = 'global',
  overrides: Partial<BirdHostDescriptor> = {},
) {
  const distribution = getDistributionManifest(distributionId);
  return createBirdHostDescriptorFromDistribution('desktop', distribution, overrides);
}
