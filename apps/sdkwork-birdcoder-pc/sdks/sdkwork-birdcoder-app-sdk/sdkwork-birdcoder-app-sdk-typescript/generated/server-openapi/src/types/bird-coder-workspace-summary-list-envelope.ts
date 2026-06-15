import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderWorkspaceSummary } from './bird-coder-workspace-summary';

export interface BirdCoderWorkspaceSummaryListEnvelope {
  items: BirdCoderWorkspaceSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
