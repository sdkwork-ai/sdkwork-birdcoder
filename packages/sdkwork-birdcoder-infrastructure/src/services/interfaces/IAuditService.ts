import type { BirdCoderIamAuditEventSummary } from '@sdkwork/birdcoder-types';

export interface IAuditService {
  getAuditEvents(): Promise<BirdCoderIamAuditEventSummary[]>;
}
