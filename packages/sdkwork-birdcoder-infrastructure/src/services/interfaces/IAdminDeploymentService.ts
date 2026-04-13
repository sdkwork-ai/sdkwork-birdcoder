import type { BirdCoderDeploymentRecordSummary } from '@sdkwork/birdcoder-types';

export interface IAdminDeploymentService {
  getDeployments(): Promise<BirdCoderDeploymentRecordSummary[]>;
}
