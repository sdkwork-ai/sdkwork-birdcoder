import type { BirdCoderProjectCollaboratorSummary } from './bird-coder-project-collaborator-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderProjectCollaboratorSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
