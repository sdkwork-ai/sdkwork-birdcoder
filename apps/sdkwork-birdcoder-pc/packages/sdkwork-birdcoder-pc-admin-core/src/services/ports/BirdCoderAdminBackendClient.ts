import type {
  BirdCoderDeploymentRecordSummary,
  BirdCoderIamAuditEventSummary,
  BirdCoderIamPolicySummary,
} from '@sdkwork/birdcoder-pc-types';

export interface BirdCoderAdminBackendClient {
  listGovernanceDeployments(): Promise<BirdCoderDeploymentRecordSummary[]>;
  listPolicies(): Promise<BirdCoderIamPolicySummary[]>;
  listAuditEvents(): Promise<BirdCoderIamAuditEventSummary[]>;
}
