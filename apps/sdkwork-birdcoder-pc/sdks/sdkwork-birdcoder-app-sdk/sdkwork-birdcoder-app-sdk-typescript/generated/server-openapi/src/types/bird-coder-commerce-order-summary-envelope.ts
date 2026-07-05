import type { BirdCoderCommerceOrderSummary } from './bird-coder-commerce-order-summary';

export interface BirdCoderCommerceOrderSummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
