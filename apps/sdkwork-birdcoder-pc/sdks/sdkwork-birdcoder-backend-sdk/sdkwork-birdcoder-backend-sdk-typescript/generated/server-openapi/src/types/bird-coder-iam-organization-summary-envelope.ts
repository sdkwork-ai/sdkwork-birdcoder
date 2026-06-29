import type { BirdCoderIamOrganizationSummary } from './bird-coder-iam-organization-summary';

export interface BirdCoderIamOrganizationSummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
