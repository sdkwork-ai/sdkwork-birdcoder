import type { BirdCoderReleaseSummary } from '@sdkwork/birdcoder-pc-types';
import type { IReleaseService } from '../interfaces/IReleaseService.ts';

export class EmptyReleaseService implements IReleaseService {
  async getReleases(): Promise<BirdCoderReleaseSummary[]> {
    return [];
  }
}
