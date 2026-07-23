import type { BirdCoderCoreHealthSummary } from './bird-coder-core-health-summary';

export interface BirdCoderCoreHealthSummaryEnvelope {
  code: 0;
  data: unknown & { item: BirdCoderCoreHealthSummary; };
  /** Server-owned request correlation id. */
  traceId: string;
}
