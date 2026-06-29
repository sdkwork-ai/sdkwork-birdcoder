import type { BirdCoderProjectCollaboratorSummary } from './bird-coder-project-collaborator-summary';

export interface BirdCoderProjectCollaboratorSummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
