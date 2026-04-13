import { getDistributionManifest } from '@sdkwork/birdcoder-distribution';
import { createBirdHostDescriptorFromDistribution } from '@sdkwork/birdcoder-host-core';

export function resolveWebRuntime(distributionId: 'cn' | 'global' = 'global') {
  const distribution = getDistributionManifest(distributionId);
  return createBirdHostDescriptorFromDistribution('web', distribution);
}
