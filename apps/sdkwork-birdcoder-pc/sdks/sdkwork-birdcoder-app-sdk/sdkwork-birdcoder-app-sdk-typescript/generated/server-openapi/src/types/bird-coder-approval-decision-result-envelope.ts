import type { BirdCoderApprovalDecisionResult } from './bird-coder-approval-decision-result';

export interface BirdCoderApprovalDecisionResultEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
