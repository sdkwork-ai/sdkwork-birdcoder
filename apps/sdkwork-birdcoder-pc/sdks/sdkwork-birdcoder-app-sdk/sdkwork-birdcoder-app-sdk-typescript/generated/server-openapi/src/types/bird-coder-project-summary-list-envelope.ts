import type { BirdCoderProjectSummary } from './bird-coder-project-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderProjectSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
