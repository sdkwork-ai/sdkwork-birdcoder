import type { BirdCoderIamRoleSummary } from './bird-coder-iam-role-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderIamRoleSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
