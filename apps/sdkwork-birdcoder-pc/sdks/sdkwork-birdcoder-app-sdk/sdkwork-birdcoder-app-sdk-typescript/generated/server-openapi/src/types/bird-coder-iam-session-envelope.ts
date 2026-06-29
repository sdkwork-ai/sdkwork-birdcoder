import type { BirdCoderIamSessionSummary } from './bird-coder-iam-session-summary';

export interface BirdCoderIamSessionEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
