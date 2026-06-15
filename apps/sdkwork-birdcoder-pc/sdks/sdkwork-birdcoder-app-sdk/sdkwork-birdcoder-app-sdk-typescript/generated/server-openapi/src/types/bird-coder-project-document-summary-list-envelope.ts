import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderProjectDocumentSummary } from './bird-coder-project-document-summary';

export interface BirdCoderProjectDocumentSummaryListEnvelope {
  items: BirdCoderProjectDocumentSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
