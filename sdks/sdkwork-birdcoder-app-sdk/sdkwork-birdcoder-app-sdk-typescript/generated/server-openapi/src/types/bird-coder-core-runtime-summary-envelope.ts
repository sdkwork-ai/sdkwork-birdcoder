import type { BirdCoderCoreRuntimeSummary } from './bird-coder-core-runtime-summary';

export interface BirdCoderCoreRuntimeSummaryEnvelope {
  code: 0;
  data: unknown & { item: BirdCoderCoreRuntimeSummary; };
  /** Server-owned request correlation id. */
  traceId: string;
}
