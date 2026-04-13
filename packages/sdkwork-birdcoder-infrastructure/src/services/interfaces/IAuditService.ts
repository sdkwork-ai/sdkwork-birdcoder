import type { BirdCoderAdminAuditEventSummary } from '@sdkwork/birdcoder-types';

export interface IAuditService {
  getAuditEvents(): Promise<BirdCoderAdminAuditEventSummary[]>;
}
