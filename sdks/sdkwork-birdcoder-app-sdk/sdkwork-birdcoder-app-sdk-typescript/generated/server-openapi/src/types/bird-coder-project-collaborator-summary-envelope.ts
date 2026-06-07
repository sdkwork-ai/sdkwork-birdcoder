import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderProjectCollaboratorSummary } from './bird-coder-project-collaborator-summary';

export interface BirdCoderProjectCollaboratorSummaryEnvelope {
  data: BirdCoderProjectCollaboratorSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
