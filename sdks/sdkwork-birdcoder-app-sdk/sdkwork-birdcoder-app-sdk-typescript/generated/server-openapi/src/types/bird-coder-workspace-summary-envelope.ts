import type { BirdCoderWorkspaceSummary } from './bird-coder-workspace-summary';

export interface BirdCoderWorkspaceSummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
