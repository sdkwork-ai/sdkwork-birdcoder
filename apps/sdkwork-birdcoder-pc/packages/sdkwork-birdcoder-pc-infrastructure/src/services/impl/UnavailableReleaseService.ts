import type { BirdCoderReleaseSummary } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IReleaseService } from '../interfaces/IReleaseService.ts';

const RELEASE_SURFACE_REQUIRED_MESSAGE =
  'Release inventory requires the admin shell bootstrap with an explicit backend SDK client.';

export class UnavailableReleaseService implements IReleaseService {
  async getReleases(): Promise<BirdCoderReleaseSummary[]> {
    throw new Error(RELEASE_SURFACE_REQUIRED_MESSAGE);
  }
}

export function createUnavailableReleaseService(): IReleaseService {
  return new UnavailableReleaseService();
}
