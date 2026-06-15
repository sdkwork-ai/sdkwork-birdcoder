import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderApprovalDecisionResult } from './bird-coder-approval-decision-result';

export interface BirdCoderApprovalDecisionResultEnvelope {
  data: BirdCoderApprovalDecisionResult;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
