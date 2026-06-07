import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderReleaseSummary } from './bird-coder-release-summary';

export interface BirdCoderReleaseSummaryListEnvelope {
  items: BirdCoderReleaseSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
