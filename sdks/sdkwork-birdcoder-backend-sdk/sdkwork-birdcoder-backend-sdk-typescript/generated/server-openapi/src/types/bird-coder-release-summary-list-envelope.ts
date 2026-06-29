import type { BirdCoderReleaseSummary } from './bird-coder-release-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderReleaseSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
