import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderDeploymentRecordSummary } from './bird-coder-deployment-record-summary';

export interface BirdCoderDeploymentRecordSummaryListEnvelope {
  items: BirdCoderDeploymentRecordSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
