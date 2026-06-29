import type { BirdCoderProjectDocumentSummary } from './bird-coder-project-document-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderProjectDocumentSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
