import type {
  BirdCoderDeploymentRecordSummary,
  BirdCoderDeploymentTargetSummary,
  BirdCoderProjectPublishResult,
  BirdCoderPublishProjectRequest,
} from '@sdkwork/birdcoder-types';

export interface IDeploymentService {
  getDeployments(): Promise<BirdCoderDeploymentRecordSummary[]>;
  getDeploymentTargets(projectId: string): Promise<BirdCoderDeploymentTargetSummary[]>;
  publishProject(
    projectId: string,
    request: BirdCoderPublishProjectRequest,
  ): Promise<BirdCoderProjectPublishResult>;
}
