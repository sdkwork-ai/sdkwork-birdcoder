import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderDeploymentTargetSummary } from './bird-coder-deployment-target-summary';

export interface BirdCoderDeploymentTargetSummaryListEnvelope {
  items: BirdCoderDeploymentTargetSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
