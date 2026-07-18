import {
  loadDefaultBirdCoderIdeService,
  type BirdCoderDefaultIdeServiceKey,
  type BirdCoderDefaultIdeServices,
} from '@sdkwork/birdcoder-pc-infrastructure/services/lazyDefaultIdeServices';

export async function loadDefaultIdeServiceFromInfrastructure<
  K extends BirdCoderDefaultIdeServiceKey,
>(
  serviceKey: K,
): Promise<BirdCoderDefaultIdeServices[K]> {
  return loadDefaultBirdCoderIdeService(serviceKey);
}
