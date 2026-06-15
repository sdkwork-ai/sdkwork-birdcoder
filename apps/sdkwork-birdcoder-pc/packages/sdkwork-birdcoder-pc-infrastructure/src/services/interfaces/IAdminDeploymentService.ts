import type { BirdCoderDeploymentRecordSummary } from '@sdkwork/birdcoder-pc-types';

export interface IAdminDeploymentService {
  getDeployments(): Promise<BirdCoderDeploymentRecordSummary[]>;
}
