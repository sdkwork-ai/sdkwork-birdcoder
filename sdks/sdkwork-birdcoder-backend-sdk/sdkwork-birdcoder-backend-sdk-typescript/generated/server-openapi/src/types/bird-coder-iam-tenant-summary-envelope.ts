import type { BirdCoderIamTenantSummary } from './bird-coder-iam-tenant-summary';

export interface BirdCoderIamTenantSummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
