import type { BirdCoderIamTenantSummary } from './bird-coder-iam-tenant-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderIamTenantSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
