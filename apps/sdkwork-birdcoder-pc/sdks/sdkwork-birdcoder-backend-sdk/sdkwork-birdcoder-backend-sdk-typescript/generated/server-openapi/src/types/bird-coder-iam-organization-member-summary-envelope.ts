import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderIamOrganizationMemberSummary } from './bird-coder-iam-organization-member-summary';

export interface BirdCoderIamOrganizationMemberSummaryEnvelope {
  data: BirdCoderIamOrganizationMemberSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
