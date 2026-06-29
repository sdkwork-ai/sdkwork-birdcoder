import type { BirdCoderNativeSessionDetail } from './bird-coder-native-session-detail';

export interface BirdCoderNativeSessionDetailEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
