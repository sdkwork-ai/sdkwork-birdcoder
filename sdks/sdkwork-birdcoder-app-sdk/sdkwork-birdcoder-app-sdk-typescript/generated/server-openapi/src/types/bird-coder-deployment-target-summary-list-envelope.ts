import type { BirdCoderDeploymentTargetSummary } from './bird-coder-deployment-target-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderDeploymentTargetSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
