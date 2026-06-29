import type { BirdCoderNativeSessionSummary } from './bird-coder-native-session-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderNativeSessionSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
