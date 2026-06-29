import type { BirdCoderCodingSessionSummary } from './bird-coder-coding-session-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderCodingSessionSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
