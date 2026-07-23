import type { BirdCoderProjectSummary } from './bird-coder-project-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderProjectSummaryListEnvelope {
  code: 0;
  data: unknown & { items: BirdCoderProjectSummary[]; pageInfo: PageInfo; };
  /** Server-owned request correlation id. */
  traceId: string;
}
