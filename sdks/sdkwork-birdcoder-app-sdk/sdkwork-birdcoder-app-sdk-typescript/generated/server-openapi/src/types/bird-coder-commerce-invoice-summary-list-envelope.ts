import type { BirdCoderCommerceInvoiceSummary } from './bird-coder-commerce-invoice-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderCommerceInvoiceSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
