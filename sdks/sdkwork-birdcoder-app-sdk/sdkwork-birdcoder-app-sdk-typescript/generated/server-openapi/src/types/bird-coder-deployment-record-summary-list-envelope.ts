import type { BirdCoderDeploymentRecordSummary } from './bird-coder-deployment-record-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderDeploymentRecordSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
