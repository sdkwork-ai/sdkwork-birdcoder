import type { BirdCoderReleaseSummary } from '@sdkwork/birdcoder-pc-contracts-commons';

export interface IReleaseService {
  getReleases(): Promise<BirdCoderReleaseSummary[]>;
}
