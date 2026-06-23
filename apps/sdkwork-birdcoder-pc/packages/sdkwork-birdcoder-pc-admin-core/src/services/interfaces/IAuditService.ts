import type { BirdCoderIamAuditEventSummary } from '@sdkwork/birdcoder-pc-types';

export interface IAuditService {
  getAuditEvents(): Promise<BirdCoderIamAuditEventSummary[]>;
}
