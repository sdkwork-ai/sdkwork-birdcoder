import type { BirdCoderNativeSessionProviderSummary } from './bird-coder-native-session-provider-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderNativeSessionProviderSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
