import type { BirdCoderCommerceOrderSummary } from './bird-coder-commerce-order-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderCommerceOrderSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
