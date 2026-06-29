import type { BirdCoderCodingSessionSummary } from './bird-coder-coding-session-summary';

export interface BirdCoderCodingSessionSummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
