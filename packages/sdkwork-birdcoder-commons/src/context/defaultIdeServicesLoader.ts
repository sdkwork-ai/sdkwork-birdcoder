import {
  loadDefaultBirdCoderIdeService,
  type BirdCoderDefaultIdeServiceKey,
  type BirdCoderDefaultIdeServices,
} from '@sdkwork/birdcoder-infrastructure';

export async function loadDefaultIdeServiceFromInfrastructure<
  K extends BirdCoderDefaultIdeServiceKey,
>(
  serviceKey: K,
): Promise<BirdCoderDefaultIdeServices[K]> {
  return loadDefaultBirdCoderIdeService(serviceKey);
}
