import type { BirdCoderWorkspaceMemberSummary } from './bird-coder-workspace-member-summary';

export interface BirdCoderWorkspaceMemberSummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
