import type { BirdCoderDeploymentRecordSummary } from '@sdkwork/birdcoder-types';

export interface IDeploymentService {
  getDeployments(): Promise<BirdCoderDeploymentRecordSummary[]>;
}
