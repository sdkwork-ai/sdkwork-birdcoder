import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderAppTemplateSummary } from './bird-coder-app-template-summary';

export interface BirdCoderAppTemplateSummaryListEnvelope {
  items: BirdCoderAppTemplateSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
