import type { BirdCoderIamApiKeySummary } from './bird-coder-iam-api-key-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderIamApiKeySummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
