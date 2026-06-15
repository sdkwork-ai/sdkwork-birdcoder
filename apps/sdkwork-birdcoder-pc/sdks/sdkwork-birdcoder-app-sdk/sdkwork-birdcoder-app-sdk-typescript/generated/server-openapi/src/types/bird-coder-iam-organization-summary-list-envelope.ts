import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderIamOrganizationSummary } from './bird-coder-iam-organization-summary';

export interface BirdCoderIamOrganizationSummaryListEnvelope {
  items: BirdCoderIamOrganizationSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
