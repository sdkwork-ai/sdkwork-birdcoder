import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderProjectCollaboratorSummary } from './bird-coder-project-collaborator-summary';

export interface BirdCoderProjectCollaboratorSummaryListEnvelope {
  items: BirdCoderProjectCollaboratorSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
