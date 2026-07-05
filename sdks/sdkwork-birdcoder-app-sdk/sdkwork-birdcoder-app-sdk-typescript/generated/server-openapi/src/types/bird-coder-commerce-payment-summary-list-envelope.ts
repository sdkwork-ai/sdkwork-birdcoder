import type { BirdCoderCommercePaymentSummary } from './bird-coder-commerce-payment-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderCommercePaymentSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
