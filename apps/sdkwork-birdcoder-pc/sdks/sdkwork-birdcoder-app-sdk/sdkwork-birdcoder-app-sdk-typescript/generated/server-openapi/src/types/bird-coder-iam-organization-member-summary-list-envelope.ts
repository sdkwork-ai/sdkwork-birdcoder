import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderIamOrganizationMemberSummary } from './bird-coder-iam-organization-member-summary';

export interface BirdCoderIamOrganizationMemberSummaryListEnvelope {
  items: BirdCoderIamOrganizationMemberSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
