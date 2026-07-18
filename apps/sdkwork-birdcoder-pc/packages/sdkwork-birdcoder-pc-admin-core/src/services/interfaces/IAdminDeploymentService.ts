import type { BirdCoderDeploymentRecordSummary } from '@sdkwork/birdcoder-pc-contracts-commons';

export interface IAdminDeploymentService {
  getDeployments(): Promise<BirdCoderDeploymentRecordSummary[]>;
}
