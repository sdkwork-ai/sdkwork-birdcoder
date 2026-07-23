import type { BirdCoderWorkspaceSummary } from './bird-coder-workspace-summary';

export interface BirdCoderWorkspaceSummaryEnvelope {
  code: 0;
  data: unknown & { item: BirdCoderWorkspaceSummary; };
  /** Server-owned request correlation id. */
  traceId: string;
}
