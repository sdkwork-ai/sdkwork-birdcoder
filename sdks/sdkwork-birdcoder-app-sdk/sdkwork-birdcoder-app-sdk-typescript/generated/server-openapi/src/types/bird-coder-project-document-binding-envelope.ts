import type { BirdCoderProjectDocumentBinding } from './bird-coder-project-document-binding';

export interface BirdCoderProjectDocumentBindingEnvelope {
  code: 0;
  data: unknown & { item: BirdCoderProjectDocumentBinding; };
  /** Server-owned request correlation id. */
  traceId: string;
}
