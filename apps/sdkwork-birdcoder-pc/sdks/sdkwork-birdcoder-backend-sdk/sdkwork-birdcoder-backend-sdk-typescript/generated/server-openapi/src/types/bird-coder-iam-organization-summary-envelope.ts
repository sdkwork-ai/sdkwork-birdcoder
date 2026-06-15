import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderIamOrganizationSummary } from './bird-coder-iam-organization-summary';

export interface BirdCoderIamOrganizationSummaryEnvelope {
  data: BirdCoderIamOrganizationSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
