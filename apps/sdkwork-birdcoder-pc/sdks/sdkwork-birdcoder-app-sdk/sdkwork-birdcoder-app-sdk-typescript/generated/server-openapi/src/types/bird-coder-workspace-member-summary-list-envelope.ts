import type { BirdCoderWorkspaceMemberSummary } from './bird-coder-workspace-member-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderWorkspaceMemberSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
