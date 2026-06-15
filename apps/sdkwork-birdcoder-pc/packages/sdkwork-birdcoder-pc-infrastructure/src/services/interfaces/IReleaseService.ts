import type { BirdCoderReleaseSummary } from '@sdkwork/birdcoder-pc-types';

export interface IReleaseService {
  getReleases(): Promise<BirdCoderReleaseSummary[]>;
}
