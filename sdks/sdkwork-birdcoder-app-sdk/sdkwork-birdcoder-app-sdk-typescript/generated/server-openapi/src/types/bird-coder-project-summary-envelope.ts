import type { BirdCoderProjectSummary } from './bird-coder-project-summary';

export interface BirdCoderProjectSummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
