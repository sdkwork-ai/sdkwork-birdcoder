import type { BirdCoderCommerceInvoiceSummary } from './bird-coder-commerce-invoice-summary';

export interface BirdCoderCommerceInvoiceSummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
