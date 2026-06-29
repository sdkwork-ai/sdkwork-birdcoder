import type { BirdCoderWorkspaceSummary } from './bird-coder-workspace-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderWorkspaceSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
