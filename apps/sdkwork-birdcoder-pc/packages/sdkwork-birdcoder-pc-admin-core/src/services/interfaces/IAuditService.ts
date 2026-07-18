import type { BirdCoderIamAuditEventSummary } from '@sdkwork/birdcoder-pc-contracts-commons';

export interface IAuditService {
  getAuditEvents(): Promise<BirdCoderIamAuditEventSummary[]>;
}
