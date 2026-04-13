import { getDistributionManifest } from '@sdkwork/birdcoder-distribution';
import { createBirdHostDescriptorFromDistribution } from '@sdkwork/birdcoder-host-core';

export function resolveDesktopRuntime(distributionId: 'cn' | 'global' = 'global') {
  const distribution = getDistributionManifest(distributionId);
  return createBirdHostDescriptorFromDistribution('desktop', distribution);
}
