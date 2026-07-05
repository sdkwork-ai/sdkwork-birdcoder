import type { BirdCoderCommercePaymentSummary } from './bird-coder-commerce-payment-summary';

export interface BirdCoderCommercePaymentSummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
