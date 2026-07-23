import type { BirdCoderProjectDocumentBinding } from './bird-coder-project-document-binding';
import type { PageInfo } from './page-info';

export interface BirdCoderProjectDocumentBindingListEnvelope {
  code: 0;
  data: unknown & { items: BirdCoderProjectDocumentBinding[]; pageInfo: PageInfo; };
  /** Server-owned request correlation id. */
  traceId: string;
}
