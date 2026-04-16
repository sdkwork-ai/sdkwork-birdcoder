import type { BirdCoderDefaultIdeServices } from '@sdkwork/birdcoder-infrastructure';

export async function loadDefaultIdeServicesFromInfrastructure(
): Promise<BirdCoderDefaultIdeServices> {
  const { createDefaultBirdCoderIdeServices } = await import(
    '@sdkwork/birdcoder-infrastructure/services/defaultIdeServices'
  );
  return createDefaultBirdCoderIdeServices();
}
