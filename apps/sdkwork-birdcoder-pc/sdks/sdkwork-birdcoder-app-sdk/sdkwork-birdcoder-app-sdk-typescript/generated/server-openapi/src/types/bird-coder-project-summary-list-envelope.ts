import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderProjectSummary } from './bird-coder-project-summary';

export interface BirdCoderProjectSummaryListEnvelope {
  items: BirdCoderProjectSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
