import type { BirdCoderCoreRuntimeSummary } from './bird-coder-core-runtime-summary';

export interface BirdCoderCoreRuntimeSummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
