import type { BirdCoderDeploymentRecordSummary } from './bird-coder-deployment-record-summary';
import type { BirdCoderDeploymentTargetSummary } from './bird-coder-deployment-target-summary';
import type { BirdCoderReleaseSummary } from './bird-coder-release-summary';

export interface BirdCoderProjectPublishResult {
  deployment: BirdCoderDeploymentRecordSummary;
  release: BirdCoderReleaseSummary;
  target: BirdCoderDeploymentTargetSummary;
}
