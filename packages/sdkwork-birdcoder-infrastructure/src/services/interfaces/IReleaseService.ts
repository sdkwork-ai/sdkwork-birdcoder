import type { BirdCoderReleaseSummary } from '@sdkwork/birdcoder-types';

export interface IReleaseService {
  getReleases(): Promise<BirdCoderReleaseSummary[]>;
}
