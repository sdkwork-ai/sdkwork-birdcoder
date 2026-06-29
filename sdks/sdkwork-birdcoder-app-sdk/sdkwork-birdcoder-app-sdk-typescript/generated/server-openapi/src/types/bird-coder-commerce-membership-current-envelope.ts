import type { BirdCoderCommerceMembershipCurrentSummary } from './bird-coder-commerce-membership-current-summary';

export interface BirdCoderCommerceMembershipCurrentEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
